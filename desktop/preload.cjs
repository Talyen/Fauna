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
    display: Object.freeze({
      read: () => ipcRenderer.invoke("fauna:display-read"),
      set: (mode) => ipcRenderer.invoke("fauna:display-set", mode),
      subscribe: (listener) => {
        const handler = (_event, state) => listener(state);
        ipcRenderer.on("fauna:display-state", handler);
        return () => ipcRenderer.removeListener("fauna:display-state", handler);
      },
    }),
    cloud: Object.freeze(
      Object.fromEntries(
        [
          "identity",
          "readLocal",
          "writeLocal",
          "acknowledge",
          "preserve",
          "importStandalone",
          "list",
          "read",
          "write",
        ].map((method) => [method, (...args) => ipcRenderer.invoke(`fauna:cloud-${method}`, ...args)]),
      ),
    ),
    onOverlay: (listener) => {
      let live = true,
        notified = false;
      const handler = (_event, active) => {
        notified = true;
        if (live) listener(active === true);
      };
      ipcRenderer.on("fauna:overlay", handler);
      ipcRenderer
        .invoke("fauna:overlay-state")
        .then((active) => {
          if (live && !notified) listener(active === true);
        })
        .catch(() => {});
      return () => {
        live = false;
        ipcRenderer.removeListener("fauna:overlay", handler);
      };
    },
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
