const { parentPort } = process;
const MAX = 1_048_576;
const validName = (name) => typeof name === "string" && /^fauna-v1-[a-f0-9]{32}-[01]\.json$/.test(name);
let client, account;
let lane = Promise.resolve();
parentPort.on("message", ({ data: message }) => {
  lane = lane.then(async () => {
    const { id, operation, args = [] } = message;
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
          const entries = client.cloud.listFiles().filter((f) => validName(f.name));
          if (entries.length > 64 || entries.some((f) => f.size > BigInt(MAX)))
            throw new Error("Cloud storage limit exceeded.");
          value = entries.map((f) => f.name);
        } else {
          const [name, payload] = args;
          if (!validName(name)) throw new Error("Invalid cloud slot.");
          if (operation === "read") {
            if (!client.cloud.fileExists(name)) value = null;
            else {
              const raw = await client.cloud.readFile(name);
              if (raw == null || Buffer.byteLength(raw) > MAX) throw new Error("Cloud read failed.");
              value = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
            }
          } else if (operation === "write") {
            if (typeof payload !== "string" || Buffer.byteLength(payload) > MAX)
              throw new Error("Invalid cloud payload.");
            if (!(await client.cloud.writeFile(name, payload))) throw new Error("Cloud upload failed.");
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
