import { launchPackaged } from "../lib/packaged-desktop.mjs";
import { isolatedDesktopEnvironment } from "../lib/desktop-environment.mjs";
import { _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import saveFormat from "../../src/game/save-format.json" with { type: "json" };
const userData = await mkdtemp(path.join(tmpdir(), "fauna-smoke-"));
let app;
let success = false;
try {
  const packaged = process.argv.includes("--packaged");
  if (packaged && process.platform !== "win32") throw new Error("Packaged Windows startup requires Windows.");
  app = packaged
    ? await launchPackaged(userData)
    : await electron.launch({
        args: ["."],
        env: isolatedDesktopEnvironment(userData),
      });
  const window = await app.firstWindow();
  window.setDefaultTimeout(20000);
  await window.getByRole("button", { name: "Collection", exact: true }).click({ timeout: 60000 });
  await window
    .locator(".collection-grid img")
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await window.getByRole("button", { name: "Back", exact: true }).click();
  await window.getByRole("button", { name: "Play", exact: true }).click();
  const starterOffer = window.locator(".draft-grid .creature-card").first();
  const starterName = (await starterOffer.getAttribute("aria-label")).replace(/^Inspect /, "");
  await starterOffer.click();
  await window.getByRole("button", { name: `Choose ${starterName}`, exact: true }).click();
  await window.getByRole("button", { name: "Begin journey" }).click();
  await window.getByRole("button", { name: "Deck", exact: true }).click();
  await window
    .locator(".deck-grid img")
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await window.getByRole("button", { name: "Close deck", exact: true }).click();
  await window.locator("[data-encounter]").first().click();
  await window.getByRole("main", { name: "Battlefield" }).waitFor();
  await window.locator('.app:not([inert])[data-save-status="saved"]').waitFor();
  const inspected = await window.evaluate(async () => (await window.faunaDesktop.readCandidates())[0].data);
  await window.getByRole("button", { name: "Open menu", exact: true }).click();
  await window.getByRole("button", { name: "Collection", exact: true }).click();
  await window.getByRole("button", { name: `Inspect ${starterName}`, exact: true }).click();
  await window.locator(".collection-ability").first().waitFor();
  if ((await window.locator(".collection-ability").count()) !== 3)
    throw new Error("Collection did not expose three base abilities.");
  const rules = await window.locator(".collection-ability .action-effect").allTextContents();
  if (rules.some((text) => !text.trim())) throw new Error("Collection ability rules are missing.");
  await window.getByRole("tab", { name: "Rank progression", exact: true }).click();
  await window.getByRole("button", { name: "Next page", exact: true }).click();
  await window.getByRole("tab", { name: "Base abilities", exact: true }).click();
  await window.getByRole("button", { name: "Back", exact: true }).click();
  await window.getByRole("button", { name: "Open menu", exact: true }).click();
  await window.getByRole("button", { name: "Continue", exact: true }).click();
  if ((await window.evaluate(async () => (await window.faunaDesktop.readCandidates())[0].data)) !== inspected)
    throw new Error("Collection browsing changed the saved battle.");
  // Exercise free swaps through the actual renderer and current-format desktop storage.
  await window.evaluate(async () => {
    const state = JSON.parse((await window.faunaDesktop.readCandidates())[0].data);
    if (state.team.length !== 1 || state.cards.length !== 3)
      throw new Error("The expedition did not begin with one starter.");
    // Continue swap coverage with a grown lineup and its complete card slots.
    for (const [kind, health, effects] of [
      ["emberback", 30, ["attack", "furnace-breath", "magma-stomp"]],
      ["prismram", 30, ["attack", "guard", "spectrum-lance"]],
    ]) {
      const id = `ally-${state.team.length}`;
      state.roster.push(kind);
      state.lineup.push(id);
      state.team.push({
        id,
        species: kind,
        health,
        block: 0,
        attacked: false,
        combat: structuredClone(state.team[0].combat),
      });
      for (const effect of effects) {
        const definitionId = `${kind}-${effect}`;
        const card = { id: `${id}:${definitionId}`, definitionId, ownerId: id, level: 0 };
        state.cards.push(card);
        state.battle.draw.push(card.id);
      }
    }
    state.roster.push("pollenmoth", "emberback");
    state.reserves = ["pollenmoth", "emberback"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind,
      health: 20,
      combat: structuredClone(state.team[0].combat),
      block: 0,
      attacked: false,
    }));
    await window.faunaDesktop.writeSave(JSON.stringify(state));
  });
  await window.reload();
  await window.getByRole("button", { name: "Continue", exact: true }).click();
  await window.getByRole("button", { name: "Swap", exact: true }).click();
  await window.getByRole("button", { name: "Pollenmoth, backup", exact: true }).click();
  await window.locator('.swap-roster [data-actor-id="ally-0"] .creature-card').click();
  await window.locator('.app:not([inert])[data-save-status="saved"]').waitFor();
  const swapped = await window.evaluate(async () =>
    JSON.parse((await window.faunaDesktop.readCandidates())[0].data),
  );
  if (
    swapped.version !== saveFormat.version ||
    swapped.team[0].species !== "pollenmoth" ||
    swapped.battle.mana !== 4 ||
    swapped.lineup[0] !== "ally-0"
  )
    throw new Error("Desktop combat swap or lineup persistence failed.");
  // Swap back to restore the original starter before checking automatic turns.
  await window.getByRole("button", { name: "Swap", exact: true }).click();
  await window.locator('.swap-roster [data-actor-id="recruit-pollenmoth"] .creature-card').click();
  await window.locator('.swap-roster [data-actor-id="ally-0"] .creature-card').click();
  await window.locator('.app:not([inert])[data-save-status="saved"]').waitFor();
  let attack = window.locator('.app:not([inert]) .hand .action-card[data-effect="attack"]').first();
  if (!(await attack.count())) {
    await window.getByRole("button", { name: "End turn" }).click();
    await window.locator('.app:not([inert])[data-save-status="saved"]').waitFor();
    attack = window.locator('.app:not([inert]) .hand .action-card[data-effect="attack"]').first();
  }
  // Exercise automatic turn settlement and pending feedback across an immediate exit.
  await window.evaluate(async () => {
    const state = JSON.parse((await window.faunaDesktop.readCandidates())[0].data);
    state.battle.mana = 1;
    // The one-enemy opening battle must survive this hit so quit/resume checks a new turn.
    state.battle.enemies[0].block = 100;
    await window.faunaDesktop.writeSave(JSON.stringify(state));
  });
  await window.reload();
  await window.getByRole("button", { name: "Continue", exact: true }).click();
  await window.getByRole("main", { name: "Battlefield" }).waitFor();
  await window.locator('.app:not([inert])[data-save-status="saved"]').waitFor();
  const before = await window.evaluate(async () =>
    JSON.parse((await window.faunaDesktop.readCandidates())[0].data),
  );
  await attack.click();
  const confirm = window.locator(".confirm-play");
  if (await confirm.count()) await confirm.click();
  else await window.locator('.app:not([inert]) .enemy-row [data-enemy-id="enemy-0"]').click();
  // Close immediately while hit feedback is still animating; the handshake must flush the accepted command.
  await app.close();
  app = undefined;
  app = packaged
    ? await launchPackaged(userData)
    : await electron.launch({
        args: ["."],
        env: isolatedDesktopEnvironment(userData),
      });
  const resumed = await app.firstWindow();
  resumed.setDefaultTimeout(20000);
  await resumed.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60000 });
  await resumed.getByRole("main", { name: "Battlefield" }).waitFor();
  const after = await resumed.evaluate(async () =>
    JSON.parse((await window.faunaDesktop.readCandidates())[0].data),
  );
  if (
    after.revision !== before.revision + 1 ||
    after.battle.mana !== 4 ||
    after.battle.turn !== before.battle.turn + 1 ||
    (after.battle.enemies[0].health >= before.battle.enemies[0].health &&
      after.battle.enemies[0].block >= before.battle.enemies[0].block)
  )
    throw new Error(
      `Combat was lost or replayed across quit/resume: ${JSON.stringify({ before: { revision: before.revision, mana: before.battle.mana, health: before.battle.enemies[0].health }, after: { revision: after.revision, mana: after.battle.mana, health: after.battle.enemies[0].health } })}`,
    );
  if (await resumed.evaluate(() => typeof window.require !== "undefined"))
    throw new Error("Node leaked to renderer.");
  const security = packaged
    ? null
    : await app.evaluate(({ BrowserWindow }) => {
        const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
          sandbox: preferences.sandbox,
          contextIsolation: preferences.contextIsolation,
          nodeIntegration: preferences.nodeIntegration,
        };
      });
  if (security && (!security.sandbox || !security.contextIsolation || security.nodeIntegration))
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
  success = true;
  console.log(
    "Desktop startup, draft, Collection ability and rank browsing, free swaps, lineup persistence, last-mana automatic turn quit/resume, and renderer isolation passed.",
  );
} finally {
  if (app && !success) {
    const child = app.process();
    if (child.exitCode === null && child.signalCode === null)
      await new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGKILL");
      });
  } else await app?.close();
  // Chromium can release profile files after its parent exits on Windows.
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch((error) => {
    if (success) throw error;
    console.error(`Smoke profile cleanup failed: ${error.message}`);
  });
}
