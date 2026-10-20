const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createStorage } = require("./storage.cjs");
const { isDevelopmentUrl } = require("./dev-url.cjs");
app.setName("Fauna");
if (process.env.FAUNA_PREVIEW_USER_DATA || process.env.FAUNA_SMOKE_USER_DATA)
  app.setPath(
    "userData",
    path.resolve(process.env.FAUNA_PREVIEW_USER_DATA || process.env.FAUNA_SMOKE_USER_DATA),
  );
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => {
  if (window && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
let quitting = false;
let closing = false;
let closeRequested = false;
let rendererGone = false;
function requestClose() {
  if (closeRequested || quitting) return;
  closeRequested = true;
  if (window && !window.isDestroyed() && !rendererGone) window.webContents.send("fauna:prepare-close");
  else finishClose();
}
function finishClose() {
  closing = true;
  Promise.resolve(storage?.drain()).then(() => {
    quitting = true;
    app.quit();
  });
}
let window;
let storage;
const dev = process.env.FAUNA_DEV_URL;
if (dev && !isDevelopmentUrl(dev)) throw new Error("Untrusted development URL.");
const entry = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
const trusted = (url) => (dev ? url === `${dev}/` || url === dev : url === entry);
app.whenReady().then(async () => {
  storage = createStorage(process.env.FAUNA_SMOKE_USER_DATA || path.join(app.getPath("userData"), "saves"));
  window = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  const authorize = (event) => {
    if (
      closing ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trusted(event.senderFrame.url)
    )
      throw new Error("Unauthorized request.");
  };
  ipcMain.handle("fauna:read", (event) => {
    authorize(event);
    return storage.readCandidates();
  });
  ipcMain.handle("fauna:write", (event, data) => {
    authorize(event);
    return storage.write(data);
  });
  ipcMain.handle("fauna:quit", (event) => {
    authorize(event);
    app.quit();
  });
  ipcMain.handle("fauna:close-ready", (event, saved) => {
    authorize(event);
    if (!closeRequested) throw new Error("No close was requested.");
    if (saved === true) finishClose();
    else closeRequested = false;
  });
  window.webContents.on("render-process-gone", () => {
    rendererGone = true;
    if (closeRequested) finishClose();
  });
  window.webContents.on("did-start-loading", () => {
    rendererGone = false;
  });
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      requestClose();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!trusted(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  await window.loadURL(dev || entry);
});
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  requestClose();
});
app.on("window-all-closed", () => app.quit());
