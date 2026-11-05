const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopControls", {
  fitToContent(height) {
    if (Number.isFinite(height) && height > 0) {
      ipcRenderer.send("fit-window-to-content", height);
    }
  },
});
