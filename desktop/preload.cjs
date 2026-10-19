const { contextBridge, ipcRenderer } = require("electron");
let closeListener = null;
ipcRenderer.on("fauna:prepare-close", async () => {
  let saved = false;
  try {
    saved = closeListener ? await closeListener() : true;
  } finally {
    await ipcRenderer.invoke("fauna:close-ready", saved);
  }
});
contextBridge.exposeInMainWorld(
  "faunaDesktop",
  Object.freeze({
    readCandidates: () => ipcRenderer.invoke("fauna:read"),
    writeSave: (data) => ipcRenderer.invoke("fauna:write", data),
    quit: () => ipcRenderer.invoke("fauna:quit"),
    onCloseRequested: (listener) => {
      closeListener = listener;
      return () => {
        if (closeListener === listener) closeListener = null;
      };
    },
  }),
);
