import { fork } from "node:child_process";

export function runOwnedWorker(file, args, timeout, { signal, spawnWorker = fork } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawnWorker(file, args, {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    let failure;
    const stop = () => {
      failure = new Error("Incomplete: worker cancelled.");
      child.kill("SIGKILL");
    };
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(() => {
      failure = new Error("Incomplete: worker watchdog exhausted.");
      child.kill("SIGKILL");
    }, timeout);
    const finish = (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      if (error) reject(error);
      else resolve();
    };
    child.once("error", finish);
    // Wait for exit before admitting another case, including after the watchdog.
    child.once("exit", (code) => {
      finish(failure ?? (code === 0 ? undefined : new Error(`Incomplete: worker exited ${code}.`)));
    });
  });
}
