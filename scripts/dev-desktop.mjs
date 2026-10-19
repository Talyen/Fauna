import { spawn } from "node:child_process";
import electron from "electron";
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"], {
  stdio: "inherit",
});
let desktop;
const stop = () => {
  desktop?.kill();
  vite.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (let i = 0; i < 100; i++) {
  if (vite.exitCode !== null) throw new Error("Development server exited.");
  try {
    const response = await fetch("http://127.0.0.1:48209");
    if (response.ok) {
      desktop = spawn(electron, ["."], {
        stdio: "inherit",
        env: { ...process.env, FAUNA_DEV_URL: "http://127.0.0.1:48209" },
      });
      desktop.on("exit", () => vite.kill());
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!desktop) {
  stop();
  throw new Error("Development server did not become ready.");
}
