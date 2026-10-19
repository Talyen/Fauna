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
  window.setDefaultTimeout(20000);
  await window.getByRole("heading", { name: /^Choose 3/ }).waitFor({ timeout: 60000 });
  for (const name of ["Mossback", "Emberfox", "Stormfin"])
    await window.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
  await window.getByRole("button", { name: "Start run" }).click();
  await window.getByRole("main", { name: "Battle 1" }).waitFor();
  await window.locator('.app[data-save-status="saved"]').waitFor();
  let attack = window.locator('.hand .action-card[data-effect="attack"]').first();
  if (!(await attack.count())) {
    await window.getByRole("button", { name: "End turn" }).click();
    await window.locator('.app[data-save-status="saved"]').waitFor();
    attack = window.locator('.hand .action-card[data-effect="attack"]').first();
  }
  // Exercise automatic turn settlement and pending feedback across an immediate exit.
  await window.evaluate(async () => {
    const state = JSON.parse((await window.faunaDesktop.readCandidates())[0].data);
    state.battle.mana = 1;
    await window.faunaDesktop.writeSave(JSON.stringify(state));
  });
  await window.reload();
  await window.getByRole("main", { name: "Battle 1" }).waitFor();
  await window.locator('.app[data-save-status="saved"]').waitFor();
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
  resumed.setDefaultTimeout(20000);
  await resumed.getByRole("main", { name: "Battle 1" }).waitFor({ timeout: 60000 });
  const after = await resumed.evaluate(async () =>
    JSON.parse((await window.faunaDesktop.readCandidates())[0].data),
  );
  if (
    after.revision !== before.revision + 1 ||
    after.battle.mana !== 3 ||
    after.battle.turn !== before.battle.turn + 1 ||
    after.battle.enemies[0].health >= before.battle.enemies[0].health
  )
    throw new Error(
      `Combat was lost or replayed across quit/resume: ${JSON.stringify({ before: { revision: before.revision, mana: before.battle.mana, health: before.battle.enemies[0].health }, after: { revision: after.revision, mana: after.battle.mana, health: after.battle.enemies[0].health } })}`,
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
  const audioState = await resumed.evaluate(async () => {
    const context = new AudioContext();
    try {
      await Promise.race([context.resume(), new Promise((resolve) => setTimeout(resolve, 1000))]);
      return context.state;
    } finally {
      await context.close();
    }
  });
  if (audioState !== "running") throw new Error(`Controller-only desktop audio is blocked: ${audioState}`);
  console.log("Desktop startup, draft, last-mana automatic turn quit/resume, and renderer isolation passed.");
} finally {
  await app?.close();
  await rm(userData, { recursive: true, force: true });
}
