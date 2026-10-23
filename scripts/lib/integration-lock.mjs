import { createHash } from "node:crypto";
import { realpathSync, existsSync } from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { git } from "./git.mjs";

export async function acquireIntegrationLock(root, { timeoutMs = 0, retryMs = 250, onBusy = () => {} } = {}) {
  const common = realpathSync(path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim()));
  // Refuse an older integrator's directory lock during the lock-protocol transition.
  if (existsSync(path.join(common, "fauna-integration.lock")))
    throw new Error(
      "Legacy integration lock is occupied. Inspect its owner before retrying; do not remove another process's lock.",
    );
  // All worktrees share this identity. The OS releases the listener even after a crash.
  const port = 20000 + (createHash("sha256").update(common).digest().readUInt32BE(0) % 40000);
  const deadline = Date.now() + timeoutMs;
  let reported = false;
  for (;;) {
    const server = net.createServer((socket) => socket.destroy());
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      });
      return () =>
        new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new Error(
          "Integration lock is occupied; bounded wait exhausted. Task preserved; retry later without terminating its owner.",
        );
      if (!reported) {
        onBusy();
        reported = true;
      }
      await delay(Math.min(retryMs, remaining));
    }
  }
}
