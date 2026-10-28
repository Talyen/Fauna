const { parentPort } = process;
const { parseRequest, validCloudSlot, CLOUD_MAX_BYTES } = require("./steam-wire.cjs");
if (!parentPort) throw new Error("Steam worker requires a parent port.");
/** @type {ReturnType<typeof import("steamworks.js").init> | undefined} */
let client;
/** @type {string | undefined} */
let account;
let lane = Promise.resolve();
parentPort.on("message", (/** @type {{data: unknown}} */ { data }) => {
  let message;
  try {
    message = parseRequest(data);
  } catch {
    return;
  }
  const { id, operation, args } = message;
  lane = lane.then(() => {
    try {
      let value;
      if (operation === "init") {
        const binding = require("steamworks.js");
        client = binding.init(args[0]);
        account = client.localplayer.getSteamId().steamId64.toString();
        if (!/^\d{1,20}$/.test(account)) throw new Error("Invalid Steam account.");
        value = account;
      } else {
        if (!client || client.localplayer.getSteamId().steamId64.toString() !== account)
          throw new Error("Steam account changed. Restart to sync safely.");
        if (operation === "language") {
          try {
            value = client.apps.currentGameLanguage() || null;
          } catch {
            value = null;
          }
          parentPort.postMessage({ id, value });
          return;
        }
        if (operation === "enabled") {
          parentPort.postMessage({
            id,
            value: client.cloud.isEnabledForAccount() && client.cloud.isEnabledForApp(),
          });
          return;
        }
        if (!client.cloud.isEnabledForAccount() || !client.cloud.isEnabledForApp())
          throw new Error("Steam Cloud is unavailable or disabled.");
        if (operation === "list") {
          const entries = client.cloud.listFiles().filter((f) => validCloudSlot(f.name));
          if (entries.length > 64) throw new Error("Cloud storage limit exceeded.");
          value = entries.map((f) => f.name);
        } else {
          const [name, payload] = args;
          if (!validCloudSlot(name)) throw new Error("Invalid cloud slot.");
          if (operation === "read") {
            if (!client.cloud.fileExists(name)) value = null;
            else {
              // Reject only the oversized slot so reconciliation can inspect intact backups.
              const entry = client.cloud.listFiles().find((file) => file.name === name);
              if (entry && entry.size > BigInt(CLOUD_MAX_BYTES))
                throw new Error("Cloud storage limit exceeded.");
              const raw = client.cloud.readFile(name);
              if (raw == null || Buffer.byteLength(raw) > CLOUD_MAX_BYTES)
                throw new Error("Cloud read failed.");
              value = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
            }
          } else if (operation === "write") {
            if (typeof payload !== "string" || Buffer.byteLength(payload) > CLOUD_MAX_BYTES)
              throw new Error("Invalid cloud payload.");
            if (!client.cloud.writeFile(name, payload)) throw new Error("Cloud upload failed.");
            value = true;
          } else throw new Error("Unknown cloud operation.");
        }
      }
      parentPort.postMessage({ id, value });
    } catch (error) {
      parentPort.postMessage({
        id,
        error: error instanceof Error ? error.message : "Steam operation failed.",
      });
    }
  });
});
