import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const userData = await mkdtemp(path.join(tmpdir(), "fauna-smoke-"));
let app;
try {
  const packaged = process.argv.includes("--packaged");
  if (packaged && process.platform !== "win32") throw new Error("Packaged Windows startup requires Windows.");
  app = await electron.launch({
    ...(packaged ? { executablePath: path.resolve("release/win-unpacked/Fauna.exe") } : { args: ["."] }),
    env: { ...process.env, FAUNA_SMOKE_USER_DATA: userData },
  });
  const window = await app.firstWindow();
  await window.getByRole("heading", { name: "A little wild. Better together." }).waitFor({ timeout: 60000 });
  for (const name of ["Mossback", "Emberfox", "Stormfin"])
    await window.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
  await window.getByRole("button", { name: "Enter the wilds" }).click();
  await window.getByRole("heading", { name: "The overgrown trail" }).waitFor();
  await window.getByRole("status").filter({ hasText: "Saved" }).waitFor();
  let attack = window
    .locator(".hand .action-card")
    .filter({ hasText: /ATTACK/ })
    .first();
  if (!(await attack.count())) {
    await window.getByRole("button", { name: "End turn" }).click();
    await window.locator(".save-status").filter({ hasText: "Saved" }).waitFor();
    attack = window
      .locator(".hand .action-card")
      .filter({ hasText: /ATTACK/ })
      .first();
  }
  const before = await window.evaluate(async () =>
    JSON.parse((await window.faunaDesktop.readCandidates())[0].data),
  );
  await attack.click();
  await window.getByRole("button", { name: "Target Bramble Imp", exact: true }).click();
  // Close immediately while hit feedback is still animating; the handshake must flush the accepted command.
  await app.close();
  app = undefined;
  app = await electron.launch({
    ...(packaged ? { executablePath: path.resolve("release/win-unpacked/Fauna.exe") } : { args: ["."] }),
    env: { ...process.env, FAUNA_SMOKE_USER_DATA: userData },
  });
  const resumed = await app.firstWindow();
  await resumed.getByRole("heading", { name: "The overgrown trail" }).waitFor({ timeout: 60000 });
  const after = await resumed.evaluate(async () =>
    JSON.parse((await window.faunaDesktop.readCandidates())[0].data),
  );
  if (
    after.revision !== before.revision + 1 ||
    after.battle.energy !== before.battle.energy - 1 ||
    after.battle.enemies[0].health >= before.battle.enemies[0].health
  )
    throw new Error(
      `Combat was lost or replayed across quit/resume: ${JSON.stringify({ before: { revision: before.revision, energy: before.battle.energy, health: before.battle.enemies[0].health }, after: { revision: after.revision, energy: after.battle.energy, health: after.battle.enemies[0].health } })}`,
    );
  if (await resumed.evaluate(() => typeof window.require !== "undefined"))
    throw new Error("Node leaked to renderer.");
  const security = await app.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: preferences.sandbox,
      contextIsolation: preferences.contextIsolation,
      nodeIntegration: preferences.nodeIntegration,
    };
  });
  if (!security.sandbox || !security.contextIsolation || security.nodeIntegration)
    throw new Error("Unsafe renderer preferences.");
  console.log("Desktop startup, draft, immediate combat quit/resume, and renderer isolation passed.");
} finally {
  await app?.close();
  await rm(userData, { recursive: true, force: true });
}
