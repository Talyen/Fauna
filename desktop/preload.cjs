const { contextBridge, ipcRenderer } = require("electron");
/** @type {(() => Promise<boolean>) | null} */
let closeListener = null;
ipcRenderer.on("fauna:prepare-close", () => {
  void prepareClose().catch(() => {});
});
async function prepareClose() {
  let saved = false;
  try {
    saved = closeListener ? await closeListener() : true;
  } finally {
    await ipcRenderer.invoke("fauna:close-ready", saved).catch(() => {});
  }
}
/** @type {import("../src/platform/ports").DesktopBridge} */
const bridge = Object.freeze({
  display: Object.freeze({
    read: () => ipcRenderer.invoke("fauna:display-read"),
    set: (/** @type {import("../src/platform/ports").DisplayState["mode"]} */ mode) =>
      ipcRenderer.invoke("fauna:display-set", mode),
    subscribe: (/** @type {(state: import("../src/platform/ports").DisplayState) => void} */ listener) => {
      const handler = (
        /** @type {Electron.IpcRendererEvent} */ _event,
        /** @type {import("../src/platform/ports").DisplayState} */ state,
      ) => listener(state);
      ipcRenderer.on("fauna:display-state", handler);
      return () => ipcRenderer.removeListener("fauna:display-state", handler);
    },
  }),
  cloud: Object.freeze({
    identity: () => ipcRenderer.invoke("fauna:cloud-identity"),
    readLocal: () => ipcRenderer.invoke("fauna:cloud-readLocal"),
    writeLocal: (/** @type {string} */ data) => ipcRenderer.invoke("fauna:cloud-writeLocal", data),
    acknowledge: (/** @type {string} */ id) => ipcRenderer.invoke("fauna:cloud-acknowledge", id),
    preserve: (/** @type {string[]} */ records) => ipcRenderer.invoke("fauna:cloud-preserve", records),
    importStandalone: (/** @type {boolean} */ use) => ipcRenderer.invoke("fauna:cloud-importStandalone", use),
    list: () => ipcRenderer.invoke("fauna:cloud-list"),
    read: (/** @type {string} */ name) => ipcRenderer.invoke("fauna:cloud-read", name),
    write: (/** @type {string} */ name, /** @type {string} */ data) =>
      ipcRenderer.invoke("fauna:cloud-write", name, data),
  }),
  onOverlay: (/** @type {(active: boolean) => void} */ listener) => {
    let live = true,
      notified = false;
    const handler = (/** @type {Electron.IpcRendererEvent} */ _event, /** @type {unknown} */ active) => {
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
  writeSave: (/** @type {string} */ data) => ipcRenderer.invoke("fauna:write", data),
  quit: () => ipcRenderer.invoke("fauna:quit"),
  onCloseRequested: (/** @type {() => Promise<boolean>} */ listener) => {
    closeListener = listener;
    return () => {
      if (closeListener === listener) closeListener = null;
    };
  },
});
contextBridge.exposeInMainWorld("faunaDesktop", bridge);
