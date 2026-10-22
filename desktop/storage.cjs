const fs = require("node:fs/promises");
const path = require("node:path");
const saveFormat = require("../src/game/save-format.json");
/** @param {string} directory */
function createStorage(directory) {
  const primary = path.join(directory, "expedition.json");
  let queue = Promise.resolve();
  return {
    async readCandidates() {
      await queue;
      const candidates = [];
      const failures = [];
      for (const [index, file] of [primary, `${primary}.bak1`, `${primary}.bak2`].entries()) {
        try {
          const stat = await fs.stat(file);
          if (stat.size > 100000) {
            candidates.push({ source: index ? "backup" : "primary", data: "oversized" });
            continue;
          }
          candidates.push({ source: index ? "backup" : "primary", data: await fs.readFile(file, "utf8") });
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) failures.push(error);
        }
      }
      if (failures.length && !candidates.length)
        throw new AggregateError(failures, "Save slots are unreadable.");
      return candidates;
    },
    /** @param {string} data */
    write(data) {
      if (typeof data !== "string" || Buffer.byteLength(data) > 100000)
        return Promise.reject(new Error("Invalid save payload."));
      try {
        const value = JSON.parse(data);
        if (value.version !== saveFormat.version) throw new Error("Unsupported save.");
      } catch (error) {
        return Promise.reject(error);
      }
      const operation = queue.then(async () => {
        await fs.mkdir(directory, { recursive: true });
        const temp = `${primary}.tmp`;
        const handle = await fs.open(temp, "w");
        try {
          await handle.writeFile(data, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        for (let i = 2; i >= 1; i--) {
          const backup = `${primary}.bak${i}`;
          const staged = `${backup}.tmp`;
          try {
            // A failed copy must never truncate an existing recovery checkpoint.
            await fs.copyFile(i === 1 ? primary : `${primary}.bak${i - 1}`, staged);
            await fs.rename(staged, backup);
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
          } finally {
            await fs.rm(staged, { force: true }).catch(() => {});
          }
        }
        await fs.rename(temp, primary);
      });
      queue = operation.catch(() => {});
      return operation;
    },
    drain() {
      return queue;
    },
  };
}
module.exports = { createStorage };
