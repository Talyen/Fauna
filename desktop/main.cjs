const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  utilityProcess,
  protocol,
  net,
  crashReporter,
} = require("electron");
const path = require("node:path");
const { ENTRY, createResourceHandler } = require("./protocol.cjs");
const { createRecovery } = require("./recovery.cjs");
protocol.registerSchemesAsPrivileged([
  { scheme: "fauna", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);
const { createSteam } = require("./steam.cjs");
const { createDisplay } = require("./display.cjs");
const { isDevelopmentUrl } = require("./dev-url.cjs");
app.setName("Fauna");
const isolatedDirectory = process.env.FAUNA_PREVIEW_USER_DATA || process.env.FAUNA_SMOKE_USER_DATA;
if (isolatedDirectory) app.setPath("userData", path.resolve(isolatedDirectory));
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
  if (closing) return;
  closing = true;
  void Promise.all([storage?.drain(), display?.dispose(), steam?.dispose()]).then(() => {
    quitting = true;
    app.quit();
  });
}
let window;
let storage;
let display;
let steam;
const dev = app.isPackaged ? undefined : process.env.FAUNA_DEV_URL;
if (dev && !isDevelopmentUrl(dev)) throw new Error("Untrusted development URL.");
const entry = ENTRY;
const trusted = (url) => (dev ? url === `${dev}/` || url === dev : url === entry);
void app.whenReady().then(async () => {
  protocol.handle(
    "fauna",
    createResourceHandler(path.join(__dirname, "../dist"), (url) => net.fetch(url)),
  );
  crashReporter.start({ uploadToServer: false });
  const isolated =
    process.env.FAUNA_DISABLE_STEAM === "1" ||
    !!process.env.FAUNA_SMOKE_USER_DATA ||
    !!process.env.FAUNA_PREVIEW_USER_DATA ||
    process.env.FAUNA_PERF_CAPTURE === "1";
  steam = await createSteam({
    app,
    utilityProcess,
    directory: process.env.FAUNA_SMOKE_USER_DATA || path.join(app.getPath("userData"), "saves"),
    isolated,
    pause: (active) => {
      if (window && !window.isDestroyed()) window.webContents.send("fauna:overlay", active);
    },
  });
  storage = steam.storage;
  display = await createDisplay({
    directory: app.getPath("userData"),
    screen,
    isolated,
    notify: (state) => {
      if (window && !window.isDestroyed()) window.webContents.send("fauna:display-state", state);
    },
  });
  window = new BrowserWindow({
    width: !app.isPackaged && process.env.FAUNA_PERF_CAPTURE === "1" ? 1280 : 1440,
    height: !app.isPackaged && process.env.FAUNA_PERF_CAPTURE === "1" ? 800 : 1000,
    ...(!isolated ? display.bounds() : {}),
    useContentSize: !app.isPackaged && process.env.FAUNA_PERF_CAPTURE === "1",
    frame: app.isPackaged || process.env.FAUNA_PERF_CAPTURE !== "1",
    minWidth: Math.min(1280, screen.getPrimaryDisplay().workArea.width),
    minHeight: Math.min(720, screen.getPrimaryDisplay().workArea.height),
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
  display.attach(window);
  const authorize = (event) => {
    if (
      closing ||
      rendererGone ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trusted(event.senderFrame.url)
    )
      throw new Error("Unauthorized request.");
  };
  for (const method of [
    "identity",
    "readLocal",
    "writeLocal",
    "acknowledge",
    "preserve",
    "importStandalone",
    "list",
    "read",
    "write",
  ]) {
    ipcMain.handle(`fauna:cloud-${method}`, (event, ...args) => {
      authorize(event);
      return steam[method](...args);
    });
  }
  ipcMain.handle("fauna:overlay-state", (event) => {
    authorize(event);
    return steam.overlay();
  });
  ipcMain.handle("fauna:display-read", (event) => {
    authorize(event);
    return display.read();
  });
  ipcMain.handle("fauna:display-set", (event, mode) => {
    authorize(event);
    return display.set(mode);
  });
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
  const recovery = createRecovery({
    directory: path.join(app.getPath("userData"), "diagnostics"),
    drain: async () => {
      await storage.drain();
      // Reading through the metadata lane waits for admitted writes; unreadable optional metadata cannot block reload.
      await steam.readLocal().catch(() => {});
    },
    reload: () => window.loadURL(dev || entry),
    closing: () => closing || closeRequested || quitting || window.isDestroyed(),
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    rendererGone = true;
    if (closeRequested) finishClose();
    else void recovery.recover(details);
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
  window.webContents.session.setPermissionCheckHandler(() => false);
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
