import { fork } from "node:child_process";

export function runOwnedWorker(file, args, timeout, { signal, spawnWorker = fork } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawnWorker(file, args, {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    let failure;
    let terminationRequested = false;
    let settled = false;
    const terminate = (error) => {
      failure ??= error;
      if (terminationRequested) return;
      terminationRequested = true;
      try {
        terminationRequested = child.kill("SIGKILL");
      } catch {
        terminationRequested = false;
        // The worker may still be running. Keep ownership until exit or close.
      }
    };
    const stop = () => terminate(new Error("Incomplete: worker cancelled."));
    const timer = setTimeout(() => terminate(new Error("Incomplete: worker watchdog exhausted.")), timeout);
    const finish = (code, bySignal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      if (failure) reject(failure);
      else if (code === 0) resolve();
      else reject(new Error(`Incomplete: worker exited ${bySignal ?? code}.`));
    };
    child.on("error", (error) => {
      if (!settled) terminate(error);
    });
    // A failed spawn emits close without exit; a running worker must leave before reuse.
    child.once("exit", finish);
    child.once("close", finish);
    signal?.addEventListener("abort", stop, { once: true });
    // The worker factory can synchronously trigger cancellation before registration.
    if (signal?.aborted) stop();
  });
}
