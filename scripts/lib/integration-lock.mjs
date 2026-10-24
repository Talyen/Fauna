import { createHash } from "node:crypto";
import {
  realpathSync,
  existsSync,
  lstatSync,
  openSync,
  closeSync,
  readSync,
  writeSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { git } from "./git.mjs";

// Only the first acquisition bridges the previous protocol. The persistent file
// also makes older integrators refuse new work instead of using a different lock.
async function retireSocketLock(common, deadline, onBusy, clock) {
  const port = 20000 + (createHash("sha256").update(common).digest().readUInt32BE(0) % 40000);
  for (;;) {
    const server = net.createServer((socket) => socket.destroy());
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      });
      const readyAt = clock.now() + 30_000;
      return async () => {
        // Old waiters have a 30-second bounded wait and check the sentinel only
        // before waiting. Keep their socket reserved until they have expired.
        await clock.delay(Math.max(0, readyAt - clock.now()));
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      };
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
      if (clock.now() >= deadline)
        throw new Error(
          "Previous integration protocol is occupied during its one-time upgrade; task preserved. Retry after its owner finishes.",
        );
      onBusy("previous protocol during one-time upgrade");
      await clock.delay(Math.min(250, Math.max(1, deadline - clock.now())));
    }
  }
}

export async function acquireIntegrationLock(
  root,
  { timeoutMs = 0, retryMs = 250, onBusy = () => {}, clock = { now: Date.now, delay } } = {},
) {
  const common = realpathSync(path.resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim()));
  const file = path.join(common, "fauna-integration.lock");
  if (lstatSync(file, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(
      "Legacy integration lock is occupied. Inspect its owner before retrying; do not remove another process's lock.",
    );
  const { tryLock } = await import("fs-native-extensions");
  const fd = openSync(file, "a+");
  const ownerFile = `${file}.owner.json`;
  const deadline = clock.now() + timeoutMs;
  let reported = false;
  const describeOwner = () => {
    try {
      const owner = JSON.parse(readFileSync(ownerFile, "utf8"));
      return `PID ${owner.pid}, ${owner.branch || "detached HEAD"}, ${owner.root}, since ${owner.started}`;
    } catch {
      return `owner unavailable; lock file ${file}`;
    }
  };
  try {
    while (!tryLock(fd)) {
      const owner = describeOwner();
      if (clock.now() >= deadline)
        throw new Error(
          `Integration lock is occupied (${owner}); bounded wait exhausted. Task preserved; retry later without terminating its owner.`,
        );
      if (!reported) {
        onBusy(owner);
        reported = true;
      }
      await clock.delay(Math.min(retryMs, Math.max(1, deadline - clock.now())));
    }
    writeFileSync(
      ownerFile,
      JSON.stringify({
        pid: process.pid,
        branch: git(root, ["branch", "--show-current"]).trim(),
        root,
        started: new Date().toISOString(),
      }),
    );
    const initialized = Buffer.alloc(1);
    const read = readSync(fd, initialized, 0, 1, 0);
    let retire;
    if (!read && existsSync(path.join(root, "scripts/lib/integration-lock.mjs")))
      retire = await retireSocketLock(common, deadline, onBusy, clock);
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        if (retire) await retire();
        if (!read) writeSync(fd, Buffer.from("1"));
        unlinkSync(ownerFile);
      } finally {
        closeSync(fd);
      }
    };
  } catch (error) {
    // Closing the descriptor releases a granted lock, including failed upgrades.
    closeSync(fd);
    throw error;
  }
}
