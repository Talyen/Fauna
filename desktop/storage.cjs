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
          if (stat.size > saveFormat.maxBytes) {
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
    /** @param {string} data @param {string[]} recoverable */
    write(data, recoverable = []) {
      if (typeof data !== "string" || Buffer.byteLength(data) > saveFormat.maxBytes)
        return Promise.reject(new Error("Invalid save payload."));
      if (
        !Array.isArray(recoverable) ||
        recoverable.length > 3 ||
        recoverable.some(
          (value) => typeof value !== "string" || Buffer.byteLength(value) > saveFormat.maxBytes,
        )
      )
        return Promise.reject(new Error("Invalid recovery checkpoints."));
      const approved = new Set(recoverable);
      try {
        const value = JSON.parse(data);
        if (value.version !== saveFormat.version) throw new Error("Unsupported save.");
      } catch (error) {
        return Promise.reject(error);
      }
      const operation = queue.then(async () => {
        await fs.mkdir(directory, { recursive: true });
        const backups = [`${primary}.bak1`, `${primary}.bak2`];
        const readable = new Set();
        /** @type {{file: string, data: string}[]} */
        const intact = [];
        for (const file of [primary, ...backups]) {
          try {
            const stat = await fs.stat(file);
            const previous = stat.size <= saveFormat.maxBytes ? await fs.readFile(file, "utf8") : null;
            readable.add(file);
            if (previous !== null && approved.has(previous) && !intact.some((item) => item.data === previous))
              intact.push({ file, data: previous });
          } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") readable.add(file);
            else if (file === primary) throw error;
            // Inaccessible backups retain their existing contents.
          }
        }
        const temp = `${primary}.tmp`;
        const handle = await fs.open(temp, "w");
        try {
          await handle.writeFile(data, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        const targets = backups.filter((file) => readable.has(file));
        for (let i = targets.length - 1; i >= 0; i--) {
          const checkpoint = intact[i];
          const backup = targets[i];
          if (!checkpoint || !backup) continue;
          const staged = `${backup}.tmp`;
          try {
            // A failed copy must never truncate an existing recovery checkpoint.
            await fs.copyFile(checkpoint.file, staged);
            await fs.rename(staged, backup);
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
