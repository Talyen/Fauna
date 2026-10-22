const fs = require("node:fs/promises");
const path = require("node:path");
/**
 * A process-wide budget prevents a faulty renderer from looping forever.
 * Admitted native saves finish before the next renderer can load them.
 * @param {{ directory: string, drain: () => Promise<unknown>, reload: () => Promise<unknown>, closing: () => boolean }} options
 */
function createRecovery({ directory, drain, reload, closing }) {
  let attempts = 0;
  let lane = Promise.resolve();
  return {
    /** @param {{ reason: string, exitCode: number }} details */
    recover(details) {
      const attempt = ++attempts;
      lane = lane
        .then(async () => {
          try {
            await fs.mkdir(directory, { recursive: true });
            // Retain only bounded platform facts; never persist player saves, URLs or paths.
            await fs.writeFile(
              path.join(directory, "renderer-crash.json"),
              JSON.stringify({
                reason: String(details.reason).slice(0, 80),
                exitCode: details.exitCode,
                attempt,
                version: process.versions.electron ?? "test",
                timestamp: new Date().toISOString(),
              }),
            );
          } catch {
            // Optional local diagnostics cannot prevent recovery or closing.
          }
          await drain();
          if (attempt <= 2 && !closing()) await reload();
        })
        .catch(() => {});
      return lane;
    },
  };
}
module.exports = { createRecovery };
