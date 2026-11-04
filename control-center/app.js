const statusElement = document.querySelector("#server-status");
const portInput = document.querySelector("#server-port");
const toggleButton = document.querySelector("#toggle-server");
const noticeElement = document.querySelector("#notice");
const logsElement = document.querySelector("#terminal-output");
const dashboardLink = document.querySelector("#dashboard-link");

let serverStatus = "loading";
let operationInProgress = false;
let logOffset = 0;
let isPollingLogs = false;
let currentPartialLine = "";

async function apiRequest(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  }
  return result;
}

function showNotice(message = "") {
  noticeElement.textContent = message;
}

function renderState(state) {
  serverStatus = state.status || "stopped";
  const statusLabels = {
    running: "Server aktif",
    starting: "Memulai server",
    stopping: "Menghentikan",
    stopped: "Server berhenti",
  };
  statusElement.dataset.status = serverStatus;
  statusElement.lastChild.textContent = ` ${statusLabels[serverStatus] || "Server berhenti"}`;
  if (document.activeElement !== portInput) {
    portInput.value = state.port || 3000;
  }

  const busy = operationInProgress || ["starting", "stopping"].includes(serverStatus);
  toggleButton.disabled = busy || serverStatus === "loading";
  portInput.disabled = busy || serverStatus !== "stopped";
  toggleButton.classList.toggle("button-start", serverStatus !== "running");
  toggleButton.classList.toggle("button-stop", serverStatus === "running");
  toggleButton.innerHTML = serverStatus === "running"
    ? '<span aria-hidden="true">■</span><span>Stop server</span>'
    : '<span aria-hidden="true">▶</span><span>Start server</span>';

  if (serverStatus === "running" && Number.isInteger(Number(state.port))) {
    dashboardLink.href = `http://127.0.0.1:${state.port}/`;
    dashboardLink.hidden = false;
  } else {
    dashboardLink.hidden = true;
  }

  if (state.error) {
    showNotice(state.error);
  }
}

async function refreshState() {
  try {
    renderState(await apiRequest("/api/state"));
  } catch (error) {
    statusElement.dataset.status = "loading";
    statusElement.lastChild.textContent = " Pengelola terputus";
    toggleButton.disabled = true;
    showNotice(`Tidak dapat terhubung ke pengelola: ${error.message}`);
  }
}

async function refreshLogs() {
  if (isPollingLogs) return;
  isPollingLogs = true;
  try {
    const result = await apiRequest(`/api/logs?from=${logOffset}`);
    const addedLines = result.lines || [];
    if (logsElement.textContent === "Menghubungkan ke pengelola...") {
      logsElement.textContent = "";
    }
    if (currentPartialLine && logsElement.textContent.endsWith(currentPartialLine)) {
      logsElement.textContent = logsElement.textContent.slice(0, -currentPartialLine.length);
    }
    if (addedLines.length) {
      logsElement.textContent += `${addedLines.join("\n")}\n`;
    }
    if (result.partial) {
      logsElement.textContent += result.partial;
    }
    currentPartialLine = result.partial || "";
    logOffset = result.offset || logOffset;
    if (logsElement.textContent.length > 50000) {
      logsElement.textContent = logsElement.textContent.slice(-40000);
    }
    logsElement.scrollTop = logsElement.scrollHeight;
  } catch (error) {
    if (!logsElement.textContent) {
      logsElement.textContent = `Gagal mengambil log: ${error.message}`;
    }
  } finally {
    isPollingLogs = false;
  }
}

toggleButton.addEventListener("click", async () => {
  const port = Number(portInput.value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    showNotice("Port harus berupa angka antara 1 dan 65535.");
    portInput.focus();
    return;
  }

  operationInProgress = true;
  toggleButton.disabled = true;
  showNotice("");
  try {
    const result = serverStatus === "running"
      ? await apiRequest("/api/stop", {})
      : await apiRequest("/api/start", { port });
    renderState(result);
    if (result.status === "running") {
      showNotice(`Dashboard berjalan pada http://127.0.0.1:${result.port}/`);
    }
  } catch (error) {
    showNotice(error.message);
    await refreshState();
  } finally {
    operationInProgress = false;
    await refreshState();
  }
  await refreshLogs();
});

portInput.addEventListener("change", async () => {
  const port = Number(portInput.value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    showNotice("Port harus berupa angka antara 1 dan 65535.");
    await refreshState();
    return;
  }
  if (serverStatus !== "stopped") {
    return;
  }
  try {
    const state = await apiRequest("/api/port", { port });
    renderState(state);
    showNotice(`Port ${state.port} berhasil disimpan.`);
  } catch (error) {
    showNotice(error.message);
    await refreshState();
  }
});

document.querySelector("#clear-logs").addEventListener("click", () => {
  logsElement.textContent = "";
  currentPartialLine = "";
});

async function refresh() {
  await Promise.all([refreshState(), refreshLogs()]);
}

refresh();
window.setInterval(refresh, 1000);
