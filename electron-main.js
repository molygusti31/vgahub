const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(process.env.VGAHUB_DATA_DIR || app.getPath("userData"));
const MANAGER_PORT_FILE = path.join(DATA_DIR, "manager.port");
let managerProcess = null;
let managerWindow = null;

function fitWindowToContent(height) {
  if (!managerWindow || !Number.isFinite(height)) {
    return;
  }
  const [width, currentHeight] = managerWindow.getContentSize();
  const nextHeight = Math.ceil(Math.max(320, Math.min(height, 1000)));
  if (Math.abs(currentHeight - nextHeight) > 1) {
    managerWindow.setContentSize(width, nextHeight);
  }
}

ipcMain.on("fit-window-to-content", (event, height) => {
  if (event.sender === managerWindow?.webContents) {
    fitWindowToContent(height);
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (managerWindow) {
      if (managerWindow.isMinimized()) managerWindow.restore();
      managerWindow.focus();
    }
  });

  app.whenReady().then(startApplication).catch((error) => {
    dialog.showErrorBox("VGAHub Dashboard", error.message);
    app.quit();
  });

  app.on("before-quit", () => {
    if (managerProcess && managerProcess.exitCode === null) {
      managerProcess.kill();
    }
  });
}

async function startApplication() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let port = readManagerPort();
  if (!port || !(await managerIsReady(port))) {
    try {
      fs.unlinkSync(MANAGER_PORT_FILE);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    managerProcess = spawn(path.join(process.resourcesPath, "Manager.exe"), ["--manager"], {
      cwd: DATA_DIR,
      env: { ...process.env, VGAHUB_DATA_DIR: DATA_DIR },
      stdio: "ignore",
      windowsHide: true,
    });
    port = await waitForManager(managerProcess);
  }

  managerWindow = new BrowserWindow({
    width: 1000,
    height: 460,
    minWidth: 800,
    minHeight: 320,
    title: "VGAHub Dashboard",
    autoHideMenuBar: true,
    useContentSize: true,
    icon: path.join(__dirname, "control-center", "vgahub.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "electron-preload.js"),
    },
  });

  managerWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  managerWindow.on("closed", () => {
    managerWindow = null;
  });
  await managerWindow.loadURL(`http://127.0.0.1:${port}/control-center/`);
  const contentHeight = await managerWindow.webContents.executeJavaScript(
    "document.documentElement.scrollHeight",
  );
  fitWindowToContent(contentHeight);
}

function readManagerPort() {
  try {
    const port = Number(fs.readFileSync(MANAGER_PORT_FILE, "utf8").trim());
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function managerIsReady(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/state`, {
      signal: AbortSignal.timeout(500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForManager(child) {
  const deadline = Date.now() + 15000;
  let launchError = null;
  child.once("error", (error) => {
    launchError = error;
  });

  while (Date.now() < deadline) {
    if (launchError) throw new Error(`Manager.exe gagal dijalankan: ${launchError.message}`);
    if (child.exitCode !== null) {
      throw new Error(`Manager.exe berhenti dengan kode ${child.exitCode}.`);
    }
    const port = readManagerPort();
    if (port && (await managerIsReady(port))) return port;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Manager.exe tidak merespons dalam 15 detik.");
}
