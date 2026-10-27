import { captureScreen } from "./support/rendered-evidence";
import { expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import type { Command } from "../../src/game/types";
import {
  authoredPack,
  prepareDestination,
  recruitChoice,
  accept,
  winBattle,
  victoryReady,
  run,
  completeRecruitment,
} from "../support/game";
import { reloadHome, test, seed, state, resume } from "./support/session";
import { gamepad } from "./support/gamepad";
import { step } from "./support/journey";

for (const [width, enlarged, outcome] of [
  [1280, true, "victory"],
  [1280, true, "defeat"],
  [1920, false, "returned"],
] as const)
  test(`journey results ${outcome} at ${width}, enlarged ${enlarged}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let game = accept(accept(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }), {
      type: "start",
    });
    let ending: Command;
    if (outcome === "victory") {
      for (let i = 0; i < 7; i++) {
        game = winBattle(accept(game, { type: "beginBattle" }));
        if (game.phase === "recruit")
          game =
            game.team.length + game.reserves.length < 5
              ? accept(game, { type: "recruit", species: game.reward!.recruits[0]! })
              : completeRecruitment(game);
        if (game.phase === "boon") game = accept(game, { type: "chooseBoon", boon: game.reward!.boons[0]! });
      }
      game = victoryReady(accept(game, { type: "beginBattle" }));
      ending = { type: "play", cardId: game.battle!.hand[0]!, targetId: "enemy-0" };
    } else {
      game = accept(game, { type: "beginBattle" });
      game = produce(game, (d) => {
        d.battleXP = { nature: 5, block: 3 };
        if (outcome === "defeat") {
          d.team[0]!.health = 1;
          d.team[0]!.combat!.deathDoorUsed = true;
          d.team[0]!.combat!.burn = 1;
        }
      });
      ending = { type: outcome === "defeat" ? "endTurn" : "abandon" };
    }
    await seed(page, game);
    if (enlarged) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: "125%", exact: true }).click();
      await page.keyboard.press("Escape");
    }
    await resume(page);
    if (ending.type === "play") {
      await page.locator(`.app:not([inert]) .hand [data-card-id="${ending.cardId}"]`).click();
    } else if (ending.type === "endTurn") {
      await page.getByRole("button", { name: "End turn", exact: true }).click();
    } else {
      await expect(page.getByRole("button", { name: "End journey", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      const end = page.getByRole("button", { name: "End journey", exact: true });
      const destructive = await end.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--destructive-text)";
        element.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      await expect(end).toHaveCSS("color", destructive);
      await expect(end.locator("svg")).toHaveCSS("stroke", destructive);
      await end.hover();
      await expect(end).toHaveCSS("color", destructive);
      await expect(end.locator("svg")).toHaveCSS("stroke", destructive);
      expect(await state(page)).toEqual(game);
      await end.click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
    }
    const defeatedBoss = outcome === "victory" ? game.battle!.enemies[0]!.species : null;
    game = accept(game, ending);
    if (outcome === "victory") {
      expect(game.phase).toBe("recruit");
      expect(game.reward!.recruits).toEqual([defeatedBoss]);
      await reloadHome(page);
      await resume(page);
      expect(await state(page)).toEqual(game);
    }
    for (let choice = 0; choice < 2 && game.phase === "recruit"; choice++) {
      const recruit = recruitChoice(game);
      await step(page, undefined, game, recruit);
      game = accept(game, recruit);
    }
    await expect(
      page.getByRole("heading", {
        name:
          outcome === "victory" ? "Journey complete" : outcome === "defeat" ? "Defeated" : "Returned home",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Final team", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Boons collected", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("New creature unlocks", { exact: true })).toHaveCount(0);
    expect(await state(page)).toEqual(game);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await captureScreen(page, {
      path: `reports/results/${outcome}-${width}-${enlarged}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Journey results", exact: true })).toHaveCount(0);
    await reloadHome(page);
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Journey results", exact: true })).toHaveCount(0);
    expect(await state(page)).toEqual(game);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    expect((await state(page)).phase).toBe("draft");
    expect((await state(page)).keywordXP).toEqual(game.keywordXP);
  });

for (const input of ["keyboard", "controller"] as const)
  test(`boss victory commits rewards with ${input}`, async ({ page }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => localStorage.setItem("fauna.text-scale", "1.25"));
    const fixture = victoryReady(
      accept(
        produce(run(7), (draft) => {
          draft.encounter = 7;
          draft.journey!.victories = draft.encounter;
          prepareDestination(draft);
          draft.expedition = { pack: authoredPack(draft.encounter), recruit: null, lastRoom: null };
          draft.journey = { outcome: null, victories: 7, currency: 0, xp: {}, lastBattle: null };
        }),
        { type: "beginBattle" },
      ),
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, fixture);
    await resume(page);
    const activate = async (el: Locator) => {
      await el.focus();
      if (press) await press(0);
      else await page.keyboard.press("Enter");
    };
    await step(page, activate);
    const reward = await state(page);
    expect(reward.phase).toBe("recruit");
    expect(reward.reward!.recruits).toEqual([fixture.battle!.enemies[0]!.species]);
    await step(page, activate);
    await expect(page.getByRole("heading", { name: "Journey complete", exact: true })).toBeVisible();
    const won = await state(page);
    expect(won.wins).toBe(1);
    expect(won.currency).toBe(fixture.currency + 40);
    expect(Object.values(won.keywordXP).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Main menu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Creature unlocked" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    expect(await state(page)).toEqual(won);
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await expect(page.getByRole("button", { name: "Inspect Prismram" })).toHaveCount(1);
  });
