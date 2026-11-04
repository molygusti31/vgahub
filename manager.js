const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const PORT_FILE = path.join(APP_DIR, "port.conf");
const PID_FILE = path.join(APP_DIR, "manager.pid");
const MANAGER_PORT_FILE = path.join(APP_DIR, "manager.port");
const LOG_FILE = path.join(APP_DIR, "server.log");
const CONTROL_CENTER_FILES = new Map([
  ["/control-center/", ["index.html", "text/html; charset=utf-8"]],
  ["/control-center/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/control-center/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/control-center/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);

let configuredPort = Number(process.env.PORT || 3000);
let serverProcess = null;
let serverStatus = "stopped";
let serverError = "";
let managerServer;
let logStartOffset = 0;
let partialLogLine = "";
let logLines = [];
let logFileSize = 0;

function appendLog(text, persist = false) {
  if (persist) {
    fs.appendFileSync(LOG_FILE, text);
    logFileSize += Buffer.byteLength(text);
  }
  const lines = `${partialLogLine}${text}`.split(/\r?\n/);
  partialLogLine = lines.pop() || "";
  logLines.push(...lines);
  if (logLines.length > 2000) {
    logStartOffset += logLines.length - 2000;
    logLines = logLines.slice(-2000);
  }
}

function syncLogFile() {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size < logFileSize) {
      logFileSize = 0;
    }
    if (stats.size > logFileSize) {
      const buffer = Buffer.alloc(stats.size - logFileSize);
      const descriptor = fs.openSync(LOG_FILE, "r");
      try {
        fs.readSync(descriptor, buffer, 0, buffer.length, logFileSize);
      } finally {
        fs.closeSync(descriptor);
      }
      appendLog(buffer.toString("utf8"));
      logFileSize = stats.size;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function syncPortFile() {
  try {
    const savedPort = Number(fs.readFileSync(PORT_FILE, "utf8").trim());
    if (Number.isInteger(savedPort) && savedPort >= 1 && savedPort <= 65535) {
      configuredPort = savedPort;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function getState() {
  if (serverProcess && serverProcess.exitCode !== null) {
    serverProcess = null;
    serverStatus = "stopped";
  }
  return {
    status: serverStatus,
    port: configuredPort,
    url: `http://127.0.0.1:${configuredPort}/`,
    error: serverError,
  };
}

function sendJSON(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function readJSON(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        reject(new Error("Permintaan terlalu besar."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format permintaan tidak valid."));
      }
    });
    request.on("error", reject);
  });
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
      } else {
        reject(error);
      }
    });
    probe.listen(port, "127.0.0.1", () => {
      probe.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  });
}

function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) {
    serverProcess = null;
    serverStatus = "stopped";
    return false;
  }

  serverProcess.kill("SIGTERM");
  serverStatus = "stopping";
  appendLog(`[${new Date().toLocaleString()}] Server dihentikan.\n`, true);
  return true;
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  const controlCenterFile = CONTROL_CENTER_FILES.get(requestUrl.pathname);
  if (request.method === "GET" && controlCenterFile) {
    try {
      const contents = fs.readFileSync(
        path.join(APP_DIR, "control-center", controlCenterFile[0]),
      );
      response.writeHead(200, {
        "Content-Type": controlCenterFile[1],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return response.end(contents);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      return sendJSON(response, 404, { error: "File Control Center tidak ditemukan." });
    }
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/state") {
    syncPortFile();
    return sendJSON(response, 200, getState());
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/logs") {
    syncLogFile();
    const start = Number(requestUrl.searchParams.get("from") || 0);
    const requestedOffset = Number.isSafeInteger(start) && start >= 0 ? start : 0;
    const offset = Math.min(
      Math.max(requestedOffset - logStartOffset, 0),
      logLines.length,
    );
    return sendJSON(response, 200, {
      lines: logLines.slice(offset),
      offset: logStartOffset + logLines.length,
      partial: partialLogLine,
    });
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/port") {
    const body = await readJSON(request);
    const port = Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return sendJSON(response, 400, {
        error: "Port harus berupa angka antara 1 dan 65535.",
      });
    }
    if (serverStatus !== "stopped") {
      return sendJSON(response, 409, {
        error: "Hentikan server sebelum mengubah port.",
      });
    }
    configuredPort = port;
    fs.writeFileSync(PORT_FILE, `${port}\n`, { mode: 0o600 });
    serverError = "";
    return sendJSON(response, 200, getState());
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/start") {
    const body = await readJSON(request);
    const port = Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return sendJSON(response, 400, {
        error: "Port harus berupa angka antara 1 dan 65535.",
      });
    }
    if (serverStatus !== "stopped") {
      return sendJSON(response, 409, {
        error: "Server sedang berjalan atau masih berhenti.",
      });
    }
    serverStatus = "starting";
    let portAvailable;
    try {
      portAvailable = await isPortAvailable(port);
    } catch (error) {
      serverStatus = "stopped";
      throw error;
    }
    if (serverStatus !== "starting") {
      return sendJSON(response, 409, {
        error: "Permintaan start dibatalkan.",
      });
    }
    if (!portAvailable) {
      serverStatus = "stopped";
      return sendJSON(response, 409, {
        error: `Port ${port} sedang digunakan aplikasi lain.`,
      });
    }

    configuredPort = port;
    fs.writeFileSync(PORT_FILE, `${port}\n`, { mode: 0o600 });
    serverError = "";
    appendLog(`[${new Date().toLocaleString()}] Memulai server pada port ${port}.\n`, true);
    serverProcess = spawn(
      process.execPath,
      process.pkg ? [] : [path.join(__dirname, "server_marugo.js")],
      {
      cwd: APP_DIR,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
      },
    );
    serverStatus = "starting";
    serverProcess.stdout.on("data", (data) => appendLog(data.toString("utf8"), true));
    serverProcess.stderr.on("data", (data) => appendLog(data.toString("utf8"), true));
    serverProcess.once("error", (error) => {
      serverError = error.message;
      appendLog(`Gagal memulai server: ${error.message}\n`, true);
      serverProcess = null;
      serverStatus = "stopped";
    });
    serverProcess.once("exit", (code, signal) => {
      const wasStopping = serverStatus === "stopping";
      if (code !== 0 && !wasStopping) {
        serverError = `Server berhenti${signal ? ` (${signal})` : ` dengan kode ${code}`}.`;
        appendLog(`${serverError}\n`, true);
      }
      serverProcess = null;
      serverStatus = "stopped";
    });
    const child = serverProcess;
    const readyDeadline = Date.now() + 10000;
    while (serverStatus === "starting" && Date.now() < readyDeadline) {
      if (child.exitCode !== null) {
        break;
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/connection`, {
          signal: AbortSignal.timeout(300),
        });
        if (response.ok) {
          serverStatus = "running";
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    if (serverStatus === "starting") {
      stopServer();
      return sendJSON(response, 500, {
        error: serverError || "Server tidak siap dalam batas waktu.",
      });
    }
    if (serverStatus === "stopped") {
      return sendJSON(response, 500, {
        error: serverError || "Server gagal dijalankan. Periksa terminal.",
      });
    }
    return sendJSON(response, 200, getState());
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/stop") {
    if (!stopServer()) {
      return sendJSON(response, 409, { error: "Server sedang tidak berjalan." });
    }
    return sendJSON(response, 200, getState());
  }

  return sendJSON(response, 404, { error: "Halaman tidak ditemukan." });
}

function cleanup() {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM");
  }
  for (const file of [PID_FILE, MANAGER_PORT_FILE]) {
    try {
      fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(`Gagal menghapus ${file}:`, error);
      }
    }
  }
}

syncPortFile();
syncLogFile();
managerServer = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (!response.headersSent) {
      sendJSON(response, 500, { error: error.message });
    } else {
      response.destroy(error);
    }
  });
});
managerServer.listen(0, "127.0.0.1", () => {
  const address = managerServer.address();
  fs.writeFileSync(PID_FILE, `${process.pid}\n`, { mode: 0o600 });
  fs.writeFileSync(MANAGER_PORT_FILE, `${address.port}\n`, { mode: 0o600 });
  console.log(`Dashboard manager berjalan di http://127.0.0.1:${address.port}/`);
});
managerServer.on("error", (error) => {
  console.error("Manager gagal dijalankan:", error);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    cleanup();
    managerServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  });
}
