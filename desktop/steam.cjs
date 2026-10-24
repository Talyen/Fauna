const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomBytes } = require("node:crypto");
const { parseReply } = require("./steam-wire.cjs");
const { createStorage } = require("./storage.cjs");
/** @param {string} name */
const validName = (name) => typeof name === "string" && /^fauna-v1-[a-f0-9]{32}-[01]\.json$/.test(name);
/**
 * @param {{app: Pick<import("electron").App, "isPackaged">, utilityProcess: Pick<typeof import("electron").utilityProcess, "fork">, directory: string, isolated: boolean, pause: (active: boolean) => void, loadBinding?: () => typeof import("./steam-overlay.cjs")}} options
 * @returns {Promise<Required<import("../src/platform/ports").CloudPort> & {storage: ReturnType<typeof createStorage>, overlay: () => boolean, dispose: () => Promise<void>}>}
 */
async function createSteam({
  app,
  utilityProcess,
  directory,
  isolated,
  pause,
  loadBinding = () => require("./steam-overlay.cjs"),
}) {
  let available = false,
    account = /** @type {string | null} */ (null),
    worker = /** @type {import("electron").UtilityProcess | undefined} */ (undefined),
    overlay = /** @type {{account: string, disconnect(): void} | null} */ (null),
    overlayActive = false;
  let device = /** @type {string | undefined} */ (undefined),
    profile = "",
    sequence = 0,
    dead = false,
    transportStopped = false;
  /** @type {Map<number, {resolve: (value: unknown) => void, reject: (error: Error) => void, timer: ReturnType<typeof setTimeout>}>} */
  const requests = new Map();
  const root = directory;
  let lane = Promise.resolve();
  /** @type {Promise<void> | undefined} */
  let disposal;
  /** @param {Error} error */
  function stopTransport(error) {
    const shouldKill = !transportStopped;
    transportStopped = true;
    for (const entry of requests.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    requests.clear();
    if (shouldKill)
      try {
        worker?.kill();
      } catch {
        // Retire requests even when the native process can no longer be signalled.
      }
  }
  /** @param {string} file @param {string} data */
  async function atomic(file, data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const handle = await fs.open(`${file}.tmp`, "w");
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(`${file}.tmp`, file);
  }
  /**
   * @template {keyof import("./steam-types").SteamRequests} K
   * @param {K} operation
   * @param {import("./steam-types").SteamRequests[K]["args"]} args
   * @returns {Promise<import("./steam-types").SteamRequests[K]["result"]>}
   */
  function request(operation, args) {
    if (dead || transportStopped || !worker) return Promise.reject(new Error("Steam transport unavailable."));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        stopTransport(
          new Error("Steam Cloud timed out. Local saves remain available; restart to reconnect."),
        );
      }, 5000);
      requests.set(id, {
        resolve: (value) => {
          try {
            resolve(parseReply(operation, value));
          } catch (error) {
            reject(error);
          }
        },
        reject,
        timer,
      });
      try {
        worker?.postMessage({ id, operation, args });
      } catch (error) {
        requests.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  if (!isolated) {
    try {
      const config = JSON.parse(await fs.readFile(path.join(__dirname, "steam-config.json"), "utf8"));
      const appId = app.isPackaged ? config.appId : Number(process.env.FAUNA_STEAM_APP_ID || config.appId);
      if (Number.isSafeInteger(appId) && appId > 0) {
        overlay = loadBinding().createOverlay(appId, (active) => {
          if (dead) return;
          overlayActive = active;
          pause(active);
        });
        account = overlay.account;
        if (!/^\d{1,20}$/.test(account)) throw new Error("Invalid Steam account.");
        profile = createHash("sha256").update(`fauna:${account}`).digest("hex").slice(0, 32);
        worker = utilityProcess.fork(path.join(__dirname, "steam-worker.cjs"), [], {
          serviceName: "Fauna cloud",
        });
        worker.on(
          "message",
          (/** @type {{id: number, value?: unknown, error?: unknown}} */ { id, value, error }) => {
            const entry = requests.get(id);
            if (!entry) return;
            requests.delete(id);
            clearTimeout(entry.timer);
            if (error) entry.reject(new Error(typeof error === "string" ? error : "Steam operation failed."));
            else entry.resolve(value);
          },
        );
        worker.on("exit", () => {
          transportStopped = true;
          for (const entry of requests.values()) {
            clearTimeout(entry.timer);
            entry.reject(new Error("Steam transport stopped."));
          }
          requests.clear();
        });
        const workerAccount = await request("init", [appId]);
        if (account !== workerAccount) throw new Error("Steam account differs between processes.");
        available = true;
      }
    } catch {
      stopTransport(new Error("Steam initialization failed."));
      worker = undefined;
      console.warn("[steam] Steam unavailable; local play remains available.");
    }
  }
  if (!isolated) {
    if (profile) {
      try {
        await atomic(path.join(root, "last-profile"), profile);
      } catch {
        /* Profile saving still reports its own actionable failures. */
      }
    } else {
      try {
        const previous = await fs.readFile(path.join(root, "last-profile"), "utf8");
        if (/^[a-f0-9]{32}$/.test(previous)) profile = previous;
      } catch {
        /* A fresh standalone installation has no previous Steam profile. */
      }
    }
  }
  const profileDir = profile ? path.join(root, "profiles", profile) : root;
  if (available) {
    try {
      try {
        device = await fs.readFile(path.join(root, "device-id"), "utf8");
      } catch (e) {
        if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
      }
      if (!/^[a-f0-9]{32}$/.test(device ?? "")) {
        device = randomBytes(16).toString("hex");
        await atomic(path.join(root, "device-id"), device);
      }
    } catch {
      available = false;
      console.warn("[steam] Device identity unavailable; cloud sync disabled.");
    }
  }
  const storage = createStorage(profileDir);
  const offlineStorage = createStorage(root);
  const metadata = path.join(profileDir, "cloud.json");
  const importMarker = path.join(profileDir, "standalone-choice");
  /** @param {string} file */
  async function readOptional(file) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > 1_048_576) throw new Error("Cloud metadata exceeds supported size.");
      return await fs.readFile(file, "utf8");
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
      throw e;
    }
  }
  /** @template T @param {() => Promise<T>} fn @param {boolean} [requiresCloud] */
  const serial = (fn, requiresCloud = false) => {
    // Revoke admission on disposal; already queued metadata must still reach disk.
    if (dead || (requiresCloud && !available))
      return Promise.reject(new Error("Steam Cloud is unavailable."));
    const operation = lane.then(fn);
    lane = operation.then(
      () => {},
      () => {},
    );
    return operation;
  };
  const requireAvailable = () => {
    if (!available || dead) throw new Error("Steam Cloud is unavailable.");
  };
  return {
    storage,
    overlay: () => overlayActive,
    identity: async () => {
      const local = available ? await storage.readCandidates() : [];
      return {
        available,
        enabled: available ? await request("enabled", []) : false,
        device: device ?? "",
        profile,
        importAvailable:
          available &&
          !local.length &&
          !(await readOptional(importMarker)) &&
          (await offlineStorage.readCandidates()).length > 0,
      };
    },
    readLocal: () => serial(() => readOptional(metadata)),
    writeLocal: (data) =>
      serial(async () => {
        if (typeof data !== "string" || Buffer.byteLength(data) > 1_048_576)
          throw new Error("Invalid cloud metadata.");
        await atomic(metadata, data);
      }, true),
    acknowledge: (id) =>
      serial(async () => {
        if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid acknowledgement.");
        await atomic(path.join(profileDir, "cloud-ack"), id);
      }, true),
    preserve: (records) =>
      serial(async () => {
        // The bounded remote inventory can conflict with one additional local head.
        if (!Array.isArray(records) || records.length > 65) throw new Error("Invalid recovery set.");
        for (const raw of records) {
          if (typeof raw !== "string" || Buffer.byteLength(raw) > 1_048_576)
            throw new Error("Invalid recovery snapshot.");
          const hash = createHash("sha256").update(raw).digest("hex");
          await atomic(path.join(profileDir, "recovery", `${hash}.json`), raw);
        }
      }, true),
    importStandalone: async (use) => {
      requireAvailable();
      if (typeof use !== "boolean") throw new Error("Invalid import choice.");
      const candidates = use ? await offlineStorage.readCandidates() : [];
      /* The application chooses the first valid current-format candidate. */ if (!use)
        await atomic(importMarker, "separate");
      return candidates;
    },
    list: async () => {
      requireAvailable();
      return request("list", []);
    },
    read: async (name) => {
      requireAvailable();
      if (!validName(name)) throw new Error("Invalid cloud slot.");
      return request("read", [name]);
    },
    write: async (name, data) => {
      requireAvailable();
      if (!validName(name) || !name.startsWith(`fauna-v1-${device}-`))
        throw new Error("Cannot overwrite another device's slot.");
      await request("write", [name, data]);
    },
    dispose() {
      if (disposal) return disposal;
      dead = true;
      // Own teardown before native cleanup can reenter or throw.
      disposal = Promise.resolve().then(async () => {
        for (const close of [() => overlay?.disconnect(), () => worker?.kill()]) {
          try {
            close();
          } catch {
            // Independent cleanup and admitted metadata must still finish.
          }
        }
        for (const entry of requests.values()) {
          clearTimeout(entry.timer);
          entry.reject(new Error("Steam transport disposed."));
        }
        requests.clear();
        await lane;
      });
      return disposal;
    },
  };
}
module.exports = { createSteam };
