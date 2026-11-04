const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("borderless", {
  openAsset: (input) => ipcRenderer.invoke("borderless:open-asset", input),
  onEdge: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("borderless:edge", handler);
    return () => ipcRenderer.removeListener("borderless:edge", handler);
  },
  capabilities: Object.freeze({
    nativeFileOpen: true,
    edgeCues: true,
    virtualDisplay: false,
  }),
});
