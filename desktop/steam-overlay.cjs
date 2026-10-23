const path = require("node:path");

/** Load only the flat API; steamworks.js runs ordinary callbacks in the separate Cloud process. */
function loadOverlayApi(directory = path.dirname(require.resolve("steamworks.js"))) {
  const koffi = require("koffi");
  const libraries = /** @type {Partial<Record<NodeJS.Platform, string>>} */ ({
    win32: "dist/win64/steam_api64.dll",
    darwin: "dist/osx/libsteam_api.dylib",
    linux: "dist/linux64/libsteam_api.so",
  });
  const relative = libraries[process.platform];
  if (!relative) throw new Error("Unsupported Steam platform.");
  const library = koffi.load(
    path.join(directory, relative).replace(/app\.asar([\\/])/, "app.asar.unpacked$1"),
  );
  const initialize = library.func("int SteamAPI_InitFlat(void *error)");
  const user = library.func("void *SteamAPI_SteamUser_v023()");
  const steamId = library.func("uint64_t SteamAPI_ISteamUser_GetSteamID(void *user)");
  return {
    initialize,
    account: () => {
      const current = user();
      if (!current) throw new Error("Steam user interface unavailable.");
      return steamId(current).toString();
    },
    shutdown: library.func("void SteamAPI_Shutdown()"),
    manual: library.func("void SteamAPI_ManualDispatch_Init()"),
    pipe: library.func("int SteamAPI_GetHSteamPipe()"),
    run: library.func("void SteamAPI_ManualDispatch_RunFrame(int pipe)"),
    next: library.func("bool SteamAPI_ManualDispatch_GetNextCallback(int pipe, void *message)"),
    free: library.func("void SteamAPI_ManualDispatch_FreeLastCallback(int pipe)"),
    active: (/** @type {Buffer} */ message) =>
      koffi.decode(koffi.decode(message, 8, "void *"), "uint8_t") !== 0,
  };
}

/**
 * @param {number} appId
 * @param {(active: boolean) => void} notify
 * @param {ReturnType<typeof loadOverlayApi>} [api]
 */
function createOverlay(appId, notify, api = loadOverlayApi()) {
  // Steam's flat initialization uses the environment when launched outside the client.
  process.env.SteamAppId = String(appId);
  const error = Buffer.alloc(1024);
  if (api.initialize(error) !== 0) throw new Error("Steam overlay initialization failed.");
  let disposed = false;
  let dispatching = false;
  let closed = false;
  const shutdown = () => {
    if (disposed && !dispatching && !closed) {
      closed = true;
      api.shutdown();
    }
  };
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer;
  try {
    const account = api.account();
    if (!/^\d{1,20}$/.test(account)) throw new Error("Invalid Steam account.");
    api.manual();
    const pipe = api.pipe();
    if (!pipe) throw new Error("Steam callback pipe unavailable.");
    // CallbackMsg_t has matching field offsets on our 64-bit targets; 24 bytes
    // includes the largest platform's trailing padding. Steam owns the payload.
    const message = Buffer.alloc(24);
    const pump = () => {
      if (disposed) return;
      dispatching = true;
      try {
        api.run(pipe);
        for (let count = 0; count < 256 && !disposed && api.next(pipe, message); count++) {
          try {
            // GameOverlayActivated_t::k_iCallback is 331; m_bActive is the first byte.
            if (message.readInt32LE(4) === 331 && message.readInt32LE(16) >= 1) notify(api.active(message));
          } finally {
            api.free(pipe);
          }
        }
      } finally {
        // A listener may dispose synchronously; release the borrowed message first.
        dispatching = false;
        shutdown();
      }
    };
    timer = setInterval(pump, 1000 / 30);
    return {
      account,
      disconnect() {
        if (disposed) return;
        disposed = true;
        clearInterval(timer);
        shutdown();
      },
    };
  } catch (error) {
    clearInterval(timer);
    api.shutdown();
    throw error;
  }
}
module.exports = { createOverlay, loadOverlayApi };
