import { spawn, spawnSync } from "node:child_process";

/** The deadline and cancellation own the entire command tree, including npm grandchildren. */
export function runInvestigation(command, args, { timeout, ...options }) {
  return new Promise((resolve) => {
    const grouped = process.platform !== "win32";
    const child = spawn(command, args, { ...options, detached: grouped });
    let failure;
    let escalation;
    const kill = (signal) => {
      if (!child.pid) return;
      if (!grouped) {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        child.kill(signal);
      } else {
        try {
          process.kill(-child.pid, signal);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
    };
    const stop = (reason) => {
      failure = reason;
      kill("SIGTERM");
      escalation ??= setTimeout(() => kill("SIGKILL"), 1000);
    };
    const interrupted = () => stop(new Error("Investigation canceled."));
    process.once("SIGINT", interrupted);
    process.once("SIGTERM", interrupted);
    const timer = setTimeout(() => stop(new Error("Investigation deadline exhausted.")), timeout);
    let spawnError;
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      clearTimeout(escalation);
      process.removeListener("SIGINT", interrupted);
      process.removeListener("SIGTERM", interrupted);
      if (failure) kill("SIGKILL");
      resolve({ status, signal, error: failure ?? spawnError });
    });
  });
}
