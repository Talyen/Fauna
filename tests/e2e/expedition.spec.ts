import { captureScreen } from "./rendered-evidence";
import { freshCombat } from "../../src/game/combat";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import { definition, species } from "../../src/game/content";
import { BOONS, TALENTS } from "../../src/game/progression";
import type { GameState } from "../../src/game/types";
import { recruitChoice, accept, policy, winBattle, run, bossReward } from "../unit/helpers";
const key = "fauna.save.v1";
async function seed(page: Page, game = createGame(7)) {
  await page.goto("/");
  await page.evaluate(
    ({ key, data }) => {
      localStorage.clear();
      localStorage.setItem(key, data);
    },
    { key, data: JSON.stringify(game) },
  );
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
}
async function saved(page: Page) {
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-save-status", "saved");
}
async function state(page: Page): Promise<GameState> {
  await saved(page);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function resume(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
async function step(page: Page, activate: (el: Locator) => Promise<void> = (el) => el.click()) {
  const s = await state(page),
    c = policy(s);
  if (c.type === "beginBattle") {
    await activate(page.locator(".app:not([inert]) [data-encounter]"));
  } else if (c.type === "recruit") {
    await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
    await activate(
      page.getByRole("button", { name: `Recruit ${species(c.species).name}`, exact: true }).first(),
    );
    if (c.replace)
      await activate(
        page
          .locator(".recruit-options .creature-card")
          .nth([...s.team, ...s.reserves].findIndex((creature) => creature.id === c.replace)),
      );
  } else if (c.type === "chooseBoon")
    await activate(
      page.getByRole("button", {
        name: `Choose ${BOONS.find((r) => r.id === c.boon)!.name}`,
        exact: true,
      }),
    );
  else if (c.type === "play") {
    await activate(page.locator(`.app:not([inert]) .hand [data-card-id="${c.cardId}"]`));
    if (c.targetId) {
      await activate(
        c.targetId.startsWith("enemy-")
          ? page.locator(`.app:not([inert]) .enemy-row [data-enemy-id="${c.targetId}"]`)
          : page.locator(`.app:not([inert]) .player-row [data-actor-id="${c.targetId}"] .creature-card`),
      );
    } else await activate(page.getByRole("button", { name: /^Play ·/ }));
  } else await activate(page.getByRole("button", { name: /^End turn/ }));
}
async function gamepad(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      mapping: "standard",
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  return async (index: number) => {
    await page.evaluate(
      (i) =>
        ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
          true),
      index,
    );
    // Observe both edges in the same animation-frame loop that polls controllers.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await page.evaluate(
      (i) =>
        ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
          false),
      index,
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  };
}
async function fits(page: Page) {
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth <= innerWidth,
      height: document.documentElement.scrollHeight <= innerHeight,
    })),
  ).toEqual({ width: true, height: true });
}

for (const width of [1280, 1920])
  for (const enlarged of [false, true])
    for (const outcome of ["victory", "defeat", "returned"] as const)
      test(`journey results ${outcome} at ${width}, enlarged ${enlarged}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        let game = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
        if (outcome === "victory") {
          for (let i = 0; i < 8; i++) {
            game = winBattle(accept(game, { type: "beginBattle" }));
            if (game.phase === "recruit")
              game =
                game.roster.length < 5
                  ? accept(game, { type: "recruit", species: game.reward!.recruits[0]! })
                  : accept(game, recruitChoice(game));
            if (game.phase === "boon")
              game = accept(game, { type: "chooseBoon", boon: game.reward!.boons[0]! });
          }
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
          game = accept(game, { type: outcome === "defeat" ? "endTurn" : "abandon" });
        }
        await seed(page, game);
        if (enlarged) {
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          await page.getByRole("radio", { name: "125%", exact: true }).click();
          await page.keyboard.press("Escape");
        }
        await page.getByRole("button", { name: "Journey results", exact: true }).click();
        await expect(
          page.getByRole("heading", {
            name:
              outcome === "victory"
                ? "Journey complete"
                : outcome === "defeat"
                  ? "Defeated"
                  : "Returned home",
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
        await page.reload();
        await page.getByRole("button", { name: "Journey results", exact: true }).click();
        expect(await state(page)).toEqual(game);
        await expect(page.getByRole("button", { name: "New journey", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Main menu", exact: true }).click();
        await page.getByRole("button", { name: "New journey", exact: true }).click();
        expect((await state(page)).phase).toBe("draft");
        expect((await state(page)).keywordXP).toEqual(game.keywordXP);
      });

for (const width of [1280, 1920])
  for (const enlarged of [false, true])
    for (const encounter of [0, 3, 7])
      test(`encounter ${encounter} enters directly at ${width}, enlarged ${enlarged}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const game = produce(
          accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" }),
          (draft) => {
            draft.encounter = encounter;
            draft.expedition!.pack = 0;
            draft.journey!.victories = encounter;
          },
        );
        await seed(page, game);
        await resume(page);
        if (enlarged) {
          await page.getByRole("button", { name: "Open menu", exact: true }).click();
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          await page.getByRole("radio", { name: "125%", exact: true }).click();
          await page.keyboard.press("Escape");
          await page.keyboard.press("Escape");
        }
        const enter = page.getByRole("button", { name: encounter === 0 ? "Combat" : "Boss", exact: true });
        await expect(page.locator(".app:not([inert]) [data-encounter]")).toHaveCount(1);
        await expect(page.locator(".app:not([inert]) [data-enemy-id]")).toHaveCount(0);
        await enter.locator("img").evaluate((image) => (image as HTMLImageElement).decode());
        await fits(page);
        await captureScreen(page, {
          path: `reports/encounters/choice-${encounter}-${width}-${enlarged}.png`,
        });
        await enter.focus();
        await page.keyboard.press("i");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(await state(page)).toEqual(game);
        await page.reload();
        await resume(page);
        expect(await state(page)).toEqual(game);
        await enter.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
        expect((await state(page)).expedition!.pack).toBe(game.expedition!.pack);
        // Enemy and action inspection remains available once combat has started.
        const enemy = page.locator(".app:not([inert]) .enemy-row .creature-card").first();
        await enemy.focus();
        await page.keyboard.press("i");
        const action = page.getByRole("dialog").locator(".inspection-thumbnails .action-card").first();
        await action.click();
        await page.keyboard.press("Escape");
        await expect(action).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(enemy).toBeFocused();
      });

test("encounter placeholder uses bounded artwork at the minimum viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const game = accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });
  await seed(page, game);
  await resume(page);
  const card = page.locator(".app:not([inert]) [data-encounter]");
  const bounds = await card.boundingBox();
  expect(bounds!.width).toBeCloseTo(640 / 3, 1);
  expect(bounds!.height).toBeCloseTo(160, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".app:not([inert]) [data-enemy-id]")).toHaveCount(0);
  await captureScreen(page, { path: "reports/encounters/narrow-choice.png", fullPage: true });
  expect(await state(page)).toEqual(game);
});

test("main menu, draft and pre-battle deck lead into the first battle", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("button", { name: "New journey", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "New journey", exact: true }).click();
  await expect(page.getByRole("button", { name: "Begin journey" })).toBeDisabled();
  const chosen = (await state(page)).starterOffers[0]!;
  const name = species(chosen).name;
  await page.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "Begin journey" }).click();
  expect((await state(page)).phase).toBe("teamSelection");
  const destination = page.locator(".app:not([inert]) [data-encounter]").first();
  await page.getByRole("button", { name: "Deck", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".action-card")).toHaveCount(3);
  await page.getByRole("dialog").locator(".action-card").first().click({ button: "right" });
  await expect(page.locator(".inspection.single-card")).toBeVisible();
  await page.locator(".inspection.single-card .action-card").hover();
  await expect(page.getByRole("tooltip")).toContainText(definition(`${chosen}-attack`).name);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await destination.click();
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
});

for (const width of [1280, 1920])
  for (const enlarged of [false, true])
    test(`onboarding starter inspection, commitment and focus return at ${width}${enlarged ? " with enlarged text" : ""}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await seed(page);
      if (enlarged) {
        await page.getByRole("button", { name: "Settings", exact: true }).click();
        await page.getByRole("radio", { name: "125%", exact: true }).click();
        await page.keyboard.press("Escape");
      }
      await page.getByRole("button", { name: "New journey", exact: true }).click();
      const begin = page.getByRole("button", { name: "Begin journey", exact: true });
      await expect(begin).toBeDisabled();
      const initial = await state(page);
      const chosen = initial.starterOffers[0]!;
      const name = species(chosen).name;
      const mossback = page.getByRole("button", { name: `Inspect ${name}`, exact: true });
      await mossback.click();
      await page.locator(".inspection-thumbnails .action-card").first().click();
      await expect(page.getByRole("button", { name: `Choose ${name}`, exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: `Choose ${name}`, exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(mossback).toBeFocused();
      expect((await state(page)).revision).toBe(initial.revision);
      await mossback.press("Enter");
      await captureScreen(page, { path: `reports/starter/inspection-${width}-${enlarged}.png` });
      await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
      await expect(mossback).toBeFocused();
      await expect(mossback).toHaveAttribute("aria-pressed", "true");
      await expect(begin).toBeEnabled();
      expect((await state(page)).selected).toEqual([chosen]);
      await mossback.click();
      await expect(page.getByRole("button", { name: /^Choose / })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.reload();
      await resume(page);
      await expect(mossback).toHaveAttribute("aria-pressed", "true");
      if (!enlarged) await fits(page);
      for (const artwork of await page.locator(".draft-grid .creature-card").all()) {
        const bounds = (await artwork.boundingBox())!;
        expect(Math.abs(bounds.width - (width === 1280 ? 240 : 800 / 3))).toBeLessThan(1);
        expect(Math.abs(bounds.height - (width === 1280 ? 180 : 200))).toBeLessThan(1);
      }
      await captureScreen(page, {
        path: `reports/starter/selection-${width}-${enlarged}.png`,
        fullPage: true,
      });
      await begin.click();
      const started = await state(page);
      expect(started.roster).toEqual([chosen]);
      expect(started.cards).toHaveLength(3);
    });

for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`one starter grows a lineup through a full expedition with ${input}`, async ({ page }) => {
    test.setTimeout(120_000);
    const press = input === "controller" ? await gamepad(page) : null;
    await page.clock.setFixedTime(new Date(7));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    await activate(page.getByRole("button", { name: "New journey", exact: true }));
    const chosen = "mossback";
    const name = species(chosen).name;
    await activate(page.getByRole("button", { name: `Inspect ${name}`, exact: true }));
    await activate(page.getByRole("button", { name: `Choose ${name}`, exact: true }));
    await activate(page.getByRole("button", { name: "Begin journey", exact: true }));
    expect((await state(page)).lineup).toEqual(["ally-0"]);
    for (let i = 0; i < 300; i++) {
      const s = await state(page);
      if (s.phase === "victory") break;
      expect(s.phase).not.toBe("defeat");
      expect(s.reward?.outcome).not.toBe("defeat");
      if (s.phase === "recruit" && s.roster.length < 5) {
        await activate(
          page
            .getByRole("button", {
              name: `Recruit ${species(s.reward!.recruits.find((kind) => !s.roster.includes(kind)) ?? s.reward!.recruits[0]!).name}`,
              exact: true,
            })
            .first(),
        );
        const recruited = await state(page);
        expect(recruited.lineup).toEqual(recruited.team.map((creature) => creature.id));
        expect(recruited.reserves).toHaveLength(Math.max(0, recruited.roster.length - 3));
      } else await step(page, activate);
    }
    await expect(page.getByRole("heading", { name: "Journey complete", exact: true })).toBeVisible();
    expect((await state(page)).team).toHaveLength(3);
  });
for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`complete expedition through separate rewards with ${input}`, async ({ page }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    await seed(page, run(7));
    await resume(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    for (let i = 0; i < 180; i++) {
      const s = await state(page);
      if (s.phase === "victory") break;
      expect(s.phase).not.toBe("defeat");
      expect(s.reward?.outcome).not.toBe("defeat");
      await step(page, activate);
    }
    await expect(page.getByRole("heading", { name: "Journey complete", exact: true })).toBeVisible();
    const won = await state(page);
    expect(won.wins).toBe(1);
    expect(won.unlocked).toContain("moonhart");
    expect(won.currency).toBe(80);
    expect(Object.values(won.keywordXP).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    expect((await state(page)).revision).toBe(won.revision);
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await expect(page.getByRole("button", { name: "Inspect Moonhart" })).toHaveCount(0);
  });
test("recruitment adds a reserve, selection swaps its kit, and remembers active choices", async ({
  page,
}) => {
  await seed(page, winBattle());
  await resume(page);
  await page.getByRole("button", { name: "Recruit Briartooth", exact: true }).click();
  expect((await state(page)).roster).toHaveLength(4);
  expect((await state(page)).phase).toBe("teamSelection");
  await expect(page.getByRole("button", { name: "Mossback, starting", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Lineup", exact: true }).click();
  const active = page.getByRole("button", { name: "Mossback, starting", exact: true }),
    reserve = page.getByRole("button", { name: "Briartooth, reserve", exact: true });
  await reserve.focus();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog", { name: "Briartooth", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reserve).toBeFocused();
  await active.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("s");
  await expect(reserve).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Lineup", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  const s = await state(page);
  expect(s.team.find((c) => c.id === s.lineup[0])!.species).toBe("briartooth");
  expect(s.cards.some((c) => c.definitionId.startsWith("mossback"))).toBe(false);
  await page.reload();
  await resume(page);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  expect((await state(page)).team[0]!.species).toBe("briartooth");
});
test("battle targeting uses remembered targets, forecasts bars, and has no targeted Play button", async ({
  page,
}) => {
  const fixture = produce(run(7), (d) => {
    const cards = d.cards.filter((c) => definition(c.definitionId).effect === "attack");
    d.battle!.hand = cards.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !cards.some((a) => a.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await resume(page);
  const before = await state(page);
  const cards = page.locator(".app:not([inert]) .hand .action-card");
  await cards.first().focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("d");
  await expect(page.getByRole("button", { name: "Target Cinder Wisp", exact: true })).toBeFocused();
  await expect(page.locator(".target-preview")).toBeVisible();
  await expect(page.locator(".confirm-play")).toHaveCount(0);
  expect((await state(page)).revision).toBe(before.revision);
  await page.keyboard.press("Escape");
  await cards.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Target Cinder Wisp", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  expect((await state(page)).revision).toBe(before.revision + 1);
  await expect(page.locator(".health-number,.intent,.battle-status,.pile-counts")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Mana \d of 4$/ })).toBeVisible();
});
test("talents purchase immediately, gate rows, reset a category, and return to the paused battle", async ({
  page,
}) => {
  const fixture = produce(run(7), (d) => {
    d.keywordXP = { burn: 100, block: 20 };
    d.talents = ["block.second-wind"];
  });
  await seed(page, fixture);
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  const burn = page.getByRole("button", { name: "Burn talents", exact: true });
  await expect(burn).toHaveAccessibleDescription("3 points available");
  await burn.click();
  const laterTalent = TALENTS.find((talent) => talent.keyword === "burn" && talent.row === 1)!;
  const later = page.getByRole("button", { name: laterTalent.name, exact: true });
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(later).toHaveAttribute("aria-disabled", "true");
  const before = (await state(page)).revision;
  await later.focus();
  await page.keyboard.press("Enter");
  expect((await state(page)).revision).toBe(before);
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "Melting Point", exact: true }).click();
  await page.getByRole("button", { name: "Flashpoint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Flashpoint, unlocked", exact: true })).toBeFocused();
  expect((await state(page)).talents).toHaveLength(3);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(later).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText("1 point available", { exact: true })).toBeVisible();
  const reset = page.getByRole("button", { name: "Reset Burn talents", exact: true });
  await reset.click();
  expect((await state(page)).talents).toEqual(["block.second-wind"]);
  expect((await state(page)).keywordXP.burn).toBe(100);
  await expect(reset).toBeDisabled();
  await expect(page.getByRole("button", { name: "Melting Point", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(burn).toBeFocused();
  await expect(burn).toHaveAccessibleDescription("3 points available");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  expect((await state(page)).battle).toEqual(fixture.battle);
});
for (const [width, height] of [
  [1280, 720],
  [1280, 800],
  [1920, 1080],
  [2560, 1080],
  [3440, 1440],
] as const)
  test(`talents overview fits all categories at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = produce(createGame(7), (draft) => {
      draft.keywordXP.burn = 100;
    });
    await seed(page, fixture);
    for (const scale of [1, 1.25]) {
      await page.evaluate((value) => localStorage.setItem("fauna.text-scale", String(value)), scale);
      await page.reload();
      await page.getByRole("button", { name: "Talents", exact: true }).click();
      const cards = page.locator(".talent-overview .action-card");
      await expect(cards).toHaveCount(14);
      await expect(
        page.getByRole("button", { name: "Burn talents", exact: true }),
      ).toHaveAccessibleDescription("3 points available");
      await page.mouse.move(0, 0);
      await page
        .locator(".talent-overview img")
        .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
      await fits(page);
      const layout = await page.locator(".talents-screen").evaluate((screen) => {
        const categories = [...screen.querySelectorAll(".talent-category")];
        const arts = [...screen.querySelectorAll(".action-card")];
        const insideWindow = (element: Element) => {
          const box = element.getBoundingClientRect();
          return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
        };
        return {
          noScroll: screen.scrollHeight <= screen.clientHeight && screen.scrollWidth <= screen.clientWidth,
          captionsVisible: categories.every((category) => [...category.children].every(insideWindow)),
          readableCaptions: categories.every((category) =>
            [...category.querySelectorAll("h2, p")].every(
              (caption) =>
                caption.scrollWidth <= caption.clientWidth && caption.scrollHeight <= caption.clientHeight,
            ),
          ),
          portraitSizes: arts.every((art) => {
            const box = art.getBoundingClientRect();
            return box.width <= 160.5 && Math.abs(box.width / box.height - 0.75) < 0.01 && box.height >= 44;
          }),
          rows: new Set(arts.map((art) => Math.round(art.getBoundingClientRect().top))).size,
        };
      });
      expect(layout).toEqual({
        noScroll: true,
        captionsVisible: true,
        readableCaptions: true,
        portraitSizes: true,
        rows: 2,
      });
      await captureScreen(page, {
        path: `reports/implementation/talents-overview-${width}-${height}-${scale}.png`,
      });
      expect((await state(page)).revision).toBe(fixture.revision);
    }
  });
test("Collection hides uncollected tooltips and uses centered collected inspection", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const locked = page.getByRole("img", { name: "Locked species" }).first();
  await expect(locked).toBeVisible();
  await locked.hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  expect(await locked.evaluate((e) => getComputedStyle(e.parentElement!).filter)).toContain("grayscale");
  await page.getByRole("button", { name: "Inspect Mossback", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Inspect Mossback", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
});
test("settings and glossary return to the pause menu; End journey requires confirmation", async ({
  page,
}) => {
  await seed(page, run());
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await page.getByRole("switch", { name: "Sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Glossary & controls" })).toBeVisible();
  await page.keyboard.press("Escape");
  const before = await state(page);
  await page.getByRole("button", { name: "End journey", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "End journey?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("alertdialog", { name: "End journey?" })).toBeVisible();
  expect((await state(page)).revision).toBe(before.revision);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(page)).phase).toBe("battle");
  await page.getByRole("button", { name: "End journey", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "End journey?" })
    .getByRole("button", { name: "End journey", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Main menu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New journey", exact: true })).toHaveCount(0);
  expect((await state(page)).phase).toBe("defeat");
});
test("last mana saves the full turn before immediate close and does not replay on resume", async ({
  page,
  context,
}) => {
  const fixture = produce(run(), (d) => {
    d.battle!.mana = 1;
    const card = d.cards.find((c) => c.definitionId === "mossback-attack")!;
    d.battle!.hand = [card.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== card.id).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await resume(page);
  await page.locator(".app:not([inert]) .hand .action-card").click();
  await page.getByRole("button", { name: "Target Bramble Imp", exact: true }).click();
  await saved(page);
  const committed = await state(page);
  expect(committed.battle!.turn).toBe(2);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await resume(reopened);
  expect(await state(reopened)).toEqual(committed);
  await expect(reopened.locator(".combat-number")).toHaveCount(0);
});
test("rewards resume without duplicate XP, currency, recruitment or boons", async ({ page }) => {
  const fixture = bossReward();
  await seed(page, fixture);
  await resume(page);
  await page.reload();
  await resume(page);
  expect((await state(page)).currency).toBe(fixture.currency);
  const before = await state(page);
  await page.reload();
  await resume(page);
  const boon = page.locator(".boon-choice").first();
  await page.keyboard.press("Tab");
  await boon.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Enter");
  const after = await state(page);
  expect(after.currency).toBe(before.currency);
  expect(after.keywordXP).toEqual(before.keywordXP);
  expect(after.boons).toHaveLength(1);
  await page.reload();
  await resume(page);
  expect((await state(page)).boons).toEqual(after.boons);
});
test("corrupt saves recover backups and all-invalid saves require explicit recovery", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ key, game }) => {
      localStorage.setItem(key, "broken");
      localStorage.setItem(`${key}.backup1`, game);
    },
    { key, game: JSON.stringify(run()) },
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText("backup");
  await resume(page);
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
  await page.evaluate((key) => {
    localStorage.clear();
    localStorage.setItem(key, "broken");
  }, key);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Save unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Start fresh" }).click();
  await expect(page.getByRole("button", { name: "New journey", exact: true })).toBeVisible();
});
test("controller edges, inspect and pause do not repeat a held confirm", async ({ page }) => {
  const press = await gamepad(page);
  await seed(page, run());
  await resume(page);
  const card = page.locator('.app:not([inert]) .hand .action-card[data-effect="attack"]').first();
  await card.focus();
  await press(2);
  await expect(page.getByRole("dialog")).toBeVisible();
  await press(1);
  await expect(card).toBeFocused();
  await press(0);
  const revision = (await state(page)).revision;
  await page.evaluate(
    () =>
      ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[0]!.pressed =
        true),
  );
  await page.waitForTimeout(500);
  await page.evaluate(
    () =>
      ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[0]!.pressed =
        false),
  );
  expect((await state(page)).revision).toBe(revision + 1);
});
for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`rendered gameplay, rewards and menus fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const fixture = produce(run(7), (d) => {
      d.roster.push("silkmoth", "briartooth");
      d.reserves = ["silkmoth", "briartooth"].map((kind) => ({
        id: `recruit-${kind}`,
        species: kind as "silkmoth" | "briartooth",
        health: 20,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
      d.keywordXP.burn = 420;
    });
    await seed(page, fixture);
    await resume(page);
    await page.mouse.move(0, 0);
    await page
      .locator(".creature-card img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await fits(page);
    expect(
      await page
        .locator(".app:not([inert]) .player-row .creature-card")
        .first()
        .evaluate((el: HTMLElement) => ({
          width: el.offsetWidth,
          height: el.offsetHeight,
        })),
    ).toEqual(
      height <= 760
        ? { width: 235, height: 176 }
        : height <= 900
          ? { width: 264, height: 198 }
          : { width: 293, height: 220 },
    );
    for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
      expect(
        await card.evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
      ).toEqual(
        height <= 760
          ? { width: 144, height: 192 }
          : height <= 900
            ? { width: 162, height: 216 }
            : { width: 180, height: 240 },
      );
      await expect(card.locator("img")).toHaveAttribute("width", "600");
    }
    await captureScreen(page, { path: `reports/implementation/battle-${width}.png` });
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Talents", exact: true }).click();
    await fits(page);
    await page.getByRole("button", { name: "Burn talents", exact: true }).click();
    await page.waitForTimeout(180);
    await captureScreen(page, { path: `reports/implementation/talents-${width}.png` });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await fits(page);
    await page
      .locator(".collection-grid img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await captureScreen(page, { path: `reports/implementation/collection-${width}.png` });
    const reward = winBattle();
    await seed(page, reward);
    await resume(page);
    await fits(page);
    await captureScreen(page, { path: `reports/implementation/rewards-${width}.png` });
    await seed(page, bossReward());
    await resume(page);
    await fits(page);
    await captureScreen(page, { path: `reports/implementation/boon-${width}.png` });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await fits(page);
    await captureScreen(page, { path: `reports/implementation/team-${width}.png` });
  });

test("real audio output, hit recoil, reduced motion, and mute follow combat outcomes", async ({ page }) => {
  await page.addInitScript(() => {
    const observed = { peak: 0, media: [] as HTMLMediaElement[], impacts: [] as string[] };
    Object.assign(window, { combatObserved: observed });
    const nativePlay = HTMLMediaElement.prototype.play;
    const connected = new WeakSet<HTMLMediaElement>();
    HTMLMediaElement.prototype.play = function () {
      if (!connected.has(this) && this.src.includes("/sounds/")) {
        connected.add(this);
        observed.media.push(this);
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        context.createMediaElementSource(this).connect(analyser);
        analyser.connect(context.destination);
        void context.resume();
        const samples = new Float32Array(analyser.fftSize);
        const timer = setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          for (const sample of samples) observed.peak = Math.max(observed.peak, Math.abs(sample));
          if (this.paused) {
            clearInterval(timer);
            void context.close();
          }
        }, 5);
      }
      return nativePlay.call(this);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches(".combatant-reaction"))
        observed.impacts.push(this.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId ?? "");
      return animate.call(this, frames, options);
    };
  });
  const fixture = produce(run(7), (d) => {
    const cards = d.cards.filter((c) =>
      ["mossback-attack", "emberfox-attack", "stormfin-attack"].includes(c.definitionId),
    );
    d.battle!.hand = cards.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !cards.some((card) => card.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await resume(page);
  await page.locator('.app:not([inert]) .hand [data-card-id="ally-0:mossback-attack"]').click();
  await page.getByRole("button", { name: "Target Bramble Imp", exact: true }).click();
  const observed = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            combatObserved: { peak: number; media: HTMLMediaElement[]; impacts: string[] };
          }
        ).combatObserved,
    );
  await expect.poll(async () => (await observed()).peak).toBeGreaterThan(0.001);
  expect((await observed()).impacts).toContain("enemy-0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const count = (await observed()).impacts.length;
  await page.locator('.app:not([inert]) .hand [data-card-id="ally-1:emberfox-attack"]').click();
  await page.getByRole("button", { name: "Target Cinder Wisp", exact: true }).click();
  expect((await observed()).impacts).toHaveLength(count);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await page.getByRole("switch", { name: "Sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Resume" }).click();
  const mediaCount = (await observed()).media.length;
  await page.getByRole("button", { name: "End turn" }).click();
  await page.waitForTimeout(400);
  expect((await observed()).media).toHaveLength(mediaCount);
  expect(
    await page.evaluate(() =>
      (window as unknown as { combatObserved: { media: HTMLMediaElement[] } }).combatObserved.media.every(
        (media) => media.paused,
      ),
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Sound", exact: true })).not.toBeChecked();
});

test("five-card hand with hidden overflow, three enemies and a full bench preserve fit and original artwork ratios", async ({
  page,
}) => {
  let s = winBattle();
  while (s.phase !== "teamSelection") s = accept(s, policy(s));
  s = produce(s, (d) => {
    d.boons = ["tattered-pages"];
    d.wins = 1;
    d.unlocked.push("moonhart");
    d.roster = ["mossback", "emberfox", "stormfin", "silkmoth", "briartooth"];
    d.reserves = ["silkmoth", "briartooth"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "silkmoth" | "briartooth",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
  });
  await seed(page, s);
  await resume(page);
  await fits(page);
  await page.locator(".app:not([inert]) [data-encounter]").click();
  await expect(page.locator(".app:not([inert]) .hand .action-card")).toHaveCount(5);
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card")).toHaveCount(3);
  await fits(page);
  const area = await page
    .locator(".app:not([inert]) .player-row .creature-card")
    .first()
    .evaluate((el: HTMLElement) => el.offsetWidth * el.offsetHeight);
  for (const card of await page.locator(".app:not([inert]) .hand .action-card").all()) {
    await card.focus();
    expect(
      Math.abs(
        (await card.evaluate((el: HTMLElement) => el.offsetWidth * el.offsetHeight)) / area -
          (0.9 / 1.1) ** 2,
      ),
    ).toBeLessThan(0.025);
  }
});
test("enlarged text and keyboard/controller row navigation keep inspection and menu controls reachable", async ({
  page,
}) => {
  await seed(page, run());
  await page.evaluate(() => localStorage.setItem("fauna.text-scale", "1.25"));
  await page.reload();
  await resume(page);
  const card = page.locator(".app:not([inert]) .hand .action-card").first();
  await card.focus();
  await page.keyboard.press("w");
  await expect(page.locator(".app:not([inert]) .player-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("w");
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close inspection", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  const close = page.getByRole("button", { name: "Close glossary", exact: true });
  await expect(close).toBeVisible();
  await close.click();
  await expect(page.getByRole("button", { name: "Glossary", exact: true })).toBeFocused();
});

test("shadcn tabs and settings retain native keyboard behavior and game navigation", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const all = page.getByRole("tab", { name: "All", exact: true });
  await all.focus();
  await page.keyboard.press("ArrowRight");
  const known = page.getByRole("tab", { name: "Collected", exact: true });
  await expect(known).toBeFocused();
  await expect(known).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    (await known.getAttribute("id")) as string,
  );
  await page.keyboard.press("d");
  await expect(page.getByRole("tab", { name: "Uncollected", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Sound", exact: true });
  await sound.focus();
  await page.keyboard.press("Space");
  await expect(sound).not.toBeChecked();
  await page.getByRole("tab", { name: "Display", exact: true }).click();
  const small = page.getByRole("radio", { name: "100%", exact: true });
  await small.focus();
  await page.keyboard.down("ArrowRight");
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.keyboard.up("ArrowRight");
  // WASD follows the same wrapping behavior as Radix's native arrow navigation.
  await page.keyboard.press("d");
  await expect(page.getByRole("radio", { name: "75%", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "75%", exact: true })).toBeChecked();
  await page.keyboard.press("a");
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(sound).not.toBeChecked();
});

test("End journey uses alert-dialog cancellation, trapping and outside-click protection", async ({
  page,
}) => {
  await seed(page, run());
  await page.getByRole("button", { name: "End journey", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "End journey?" });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  // Clicking the overlay may blur the focused button without dismissing.
  await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "End journey", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "End journey", exact: true })).toBeFocused();
  expect((await state(page)).phase).toBe("battle");
});

test("battle tooltips, pointer targeting, Mana forecast and corners follow the design system", async ({
  page,
}) => {
  const fixture = produce(run(7), (d) => {
    const cards = d.cards.filter((c) => definition(c.definitionId).effect === "attack");
    d.battle!.hand = cards.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !cards.some((a) => a.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
    d.battle!.enemies[0]!.health = 1;
  });
  await seed(page, fixture);
  await resume(page);
  const enemy = page.locator(".app:not([inert]) .enemy-row .creature-card").first();
  await enemy.hover();
  await expect(page.locator(".game-tooltip").first()).toHaveAttribute("data-side", "bottom");
  const ally = page.locator(".app:not([inert]) .player-row .creature-card").first();
  await ally.hover();
  await expect(page.locator(".game-tooltip").first()).toHaveAttribute("data-side", "top");
  const card = page.locator(".app:not([inert]) .hand .action-card").first();
  await card.hover();
  await expect(page.locator(".game-tooltip").first()).toHaveAttribute("data-side", "top");
  await card.click();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  expect(await enemy.evaluate((el) => el === document.activeElement)).toBe(false);
  await expect(page.locator(".game-tooltip")).toHaveCount(0);
  await expect(page.locator(".app:not([inert]) .player-row .invalid-target")).toHaveCount(3);
  await expect(page.locator('.mana-gem[data-preview-spent="true"]')).toHaveCount(1);
  await expect(page.locator(".knockout-preview")).toHaveCount(0);
  await enemy.hover();
  await expect(page.locator(".knockout-preview")).toHaveCount(1);
  expect((await state(page)).battle!.mana).toBe(4);
  await page.mouse.move(0, 0);
  await expect(page.locator(".game-tooltip")).toHaveCount(0);
  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page
          .locator(".battle-screen img")
          .evaluateAll((images) =>
            images.every(
              (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await fits(page);
    await enemy.hover();
    await expect(page.locator(".knockout-preview")).toHaveCount(1);
    await captureScreen(page, { path: `reports/battle-review/targeting-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const el of [enemy, ally, card, page.locator(".end-turn")])
    expect(await el.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThan(
      0,
    );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".battle-screen")).toHaveAttribute("data-selected-card", "");
  await expect(page.locator('.mana-gem[data-preview-spent="true"]')).toHaveCount(0);
  await card.click();
  await enemy.click();
  await expect(page.locator(".app:not([inert]) .enemy-row .knocked-out")).toHaveCount(1);
  await expect(page.locator(".app:not([inert]) .enemy-row .creature-card")).toHaveCount(3);
  expect(
    await page
      .locator(".app:not([inert]) .hand .action-card")
      .evaluateAll((cards) => cards.some((c) => c === document.activeElement)),
  ).toBe(false);
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  await page.locator(".app:not([inert]) .hand .action-card").first().click();
  await ally.focus();
  await page.keyboard.press("d");
  await expect(
    page.locator(".app:not([inert]) .enemy-row .creature-wrap:not(.knocked-out) .creature-card:focus"),
  ).toHaveCount(1);
  await card.hover();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  await page.keyboard.press("d");
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "keyboard");
});

test("navigation returns to the nearest remaining card; denial is visual and respects motion", async ({
  page,
}) => {
  const fixture = produce(run(7), (d) => {
    const cards = d.cards.filter((c) => definition(c.definitionId).effect === "attack");
    d.battle!.hand = cards.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !cards.some((a) => a.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await resume(page);
  const cards = page.locator(".app:not([inert]) .hand .action-card");
  const last = await cards.nth(2).getAttribute("data-card-id");
  await cards.nth(1).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator(`.app:not([inert]) .hand [data-card-id="${last}"]`)).toBeFocused();
  const before = await state(page);
  await cards.first().click();
  const unavailable = page.locator(".app:not([inert]) .player-row .invalid-target").first();
  await unavailable.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await unavailable.evaluate((el) =>
      el
        .getAnimations()
        .some(
          (a) => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some((k) => "translate" in k),
        ),
    ),
  ).toBe(true);
  expect((await state(page)).revision).toBe(before.revision);
  await expect(page.getByText("Not enough mana.", { exact: true })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(200);
  await unavailable.click();
  expect(
    await unavailable.evaluate((el) =>
      el
        .getAnimations()
        .some(
          (a) => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().some((k) => "translate" in k),
        ),
    ),
  ).toBe(false);
});

test("controller navigation preserves its device mode and can confirm a pointer-selected card", async ({
  page,
}) => {
  const press = await gamepad(page);
  const fixture = produce(run(7), (d) => {
    const attacks = d.cards.filter((c) => definition(c.definitionId).effect === "attack");
    d.battle!.hand = attacks.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !attacks.some((a) => a.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  await page.getByRole("button", { name: "Physical talents", exact: true }).focus();
  await press(15);
  await expect(page.getByRole("button", { name: "Burn talents", exact: true })).toBeFocused();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "controller");
  await press(1);
  await resume(page);
  await page.locator(".app:not([inert]) .hand .action-card").first().click();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "pointer");
  const selected = page.locator(".app:not([inert]) .hand .action-card.selected");
  await expect(selected).toHaveCSS("outline-style", "none");
  expect(await selected.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  const before = await state(page);
  await press(0);
  expect((await state(page)).revision).toBe(before.revision + 1);
  await expect(page.locator(".app:not([inert]) .hand .action-card").first()).toBeFocused();
  await expect(page.locator(".app:not([inert])")).toHaveAttribute("data-input", "controller");
});

for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`free combat swaps save, replace hand cards, and preserve the starting lineup with ${input}`, async ({
    page,
  }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    const fixture = produce(run(7), (d) => {
      d.roster.push("silkmoth", "briartooth");
      d.reserves = ["silkmoth", "briartooth"].map((kind) => ({
        id: `recruit-${kind}`,
        species: kind as "silkmoth" | "briartooth",
        health: 20,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
      d.team[1]!.health = 9;
      const cards = d.cards.filter((c) => c.ownerId === "ally-1");
      d.battle!.hand = [cards[0]!.id];
      d.battle!.discard = [cards[1]!.id];
      d.battle!.draw = d.cards.filter((c) => ![cards[0]!.id, cards[1]!.id].includes(c.id)).map((c) => c.id);
    });
    await seed(page, fixture);
    await resume(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    await expect(page.locator('.app:not([inert]) .player-row [data-species="silkmoth"]')).toHaveCount(0);
    await activate(page.getByRole("button", { name: "Swap", exact: true }));
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".creature-card")).toHaveCount(5);
    if (input === "keyboard") {
      await dialog.getByRole("button", { name: "Mossback, deployed", exact: true }).focus();
      await page.keyboard.press("a");
      await expect(dialog.getByRole("button", { name: "Stormfin, deployed", exact: true })).toBeFocused();
      await page.keyboard.press("s");
      await expect(dialog.getByRole("button", { name: "Briartooth, reserve", exact: true })).toBeFocused();
      await page.keyboard.press("d");
      await expect(dialog.getByRole("button", { name: "Silkmoth, reserve", exact: true })).toBeFocused();
    }

    await activate(dialog.getByRole("button", { name: "Silkmoth, reserve", exact: true }));
    await activate(dialog.getByRole("button", { name: "Emberfox, deployed", exact: true }));
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Swap", exact: true })).toBeFocused();
    const swapped = await state(page);
    expect(swapped.battle!.mana).toBe(fixture.battle!.mana);
    expect(swapped.battle!.turn).toBe(fixture.battle!.turn);
    expect(swapped.battle!.hand).toEqual(fixture.battle!.hand);
    expect(swapped.battle!.draw).toEqual(fixture.battle!.draw);
    expect(swapped.battle!.discard).toEqual(fixture.battle!.discard);
    expect(swapped.lineup).toEqual(fixture.lineup);
    expect(swapped.reserves.find((c) => c.species === "emberfox")!.health).toBe(9);
    await expect(page.locator(".app:not([inert]) .hand .action-card img")).toHaveAttribute(
      "src",
      /\/art\/silkmoth-action\.svg$/,
    );
    await page.reload();
    await resume(page);
    expect(await state(page)).toEqual(swapped);
    await activate(page.getByRole("button", { name: "Open menu" }));
    await expect(page.getByRole("button", { name: "Lineup", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await activate(page.getByRole("button", { name: "Swap", exact: true }));
    await activate(page.getByRole("button", { name: "Silkmoth, deployed", exact: true }));
    await activate(page.getByRole("button", { name: "Emberfox, reserve", exact: true }));
    expect((await state(page)).team[1]!.health).toBe(9);
  });

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`live Swap and optional Lineup fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const fixture = produce(run(7), (d) => {
      d.roster.push("silkmoth", "briartooth");
      d.reserves = ["silkmoth", "briartooth"].map((kind) => ({
        id: `recruit-${kind}`,
        species: kind as "silkmoth" | "briartooth",
        health: 20,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      }));
    });
    await seed(page, fixture);
    await resume(page);
    await captureScreen(page, { path: `reports/swapping/battle-${width}.png` });
    await page.getByRole("button", { name: "Swap", exact: true }).click();
    await page.getByRole("button", { name: "Emberfox, deployed", exact: true }).click();
    await page.mouse.move(0, 0);
    await fits(page);
    const dialog = page.getByRole("dialog");
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    for (const card of await dialog.locator(".creature-card").all()) {
      const size = (await card.boundingBox())!;
      expect(Math.abs(size.width / size.height - 4 / 3)).toBeLessThan(0.01);
    }
    await captureScreen(page, { path: `reports/swapping/swap-${width}.png` });
    await page.keyboard.press("Escape");
    const reward = winBattle(fixture);
    await seed(page, reward);
    await resume(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Lineup", exact: true }).click();
    await page.mouse.move(0, 0);
    await fits(page);
    await captureScreen(page, { path: `reports/swapping/lineup-${width}.png` });
    await page.getByRole("button", { name: "Silkmoth, reserve", exact: true }).click();
    await page.getByRole("button", { name: "Mossback, starting", exact: true }).click();
    const edited = await state(page);
    expect(edited.lineup[0]).toBe("recruit-silkmoth");
    expect(edited.phase).toBe("recruit");
    expect(edited.reward).toEqual(reward.reward);
    await page.reload();
    await resume(page);
    expect((await state(page)).lineup[0]).toBe("recruit-silkmoth");
  });

test("a fallen deployed row resumes with no playable cards and can recover through a reserve swap", async ({
  page,
}) => {
  let s = produce(run(7), (d) => {
    d.roster.push("silkmoth", "briartooth");
    d.reserves = ["silkmoth", "briartooth"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "silkmoth" | "briartooth",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
    d.phase = "teamSelection";
    d.battle = null;
    d.encounter = 1;
  });
  s = accept(s, { type: "beginBattle" });
  s = produce(s, (d) =>
    d.team.forEach((c) => {
      c.health = 0;
      c.block = 0;
    }),
  );
  await seed(page, s);
  await resume(page);
  await page.getByRole("button", { name: "End turn", exact: true }).click();
  await expect(page.locator(".app:not([inert]) .hand .action-card")).toHaveCount(0);
  const fallen = await state(page);
  expect(fallen.phase).toBe("battle");
  expect(fallen.team.every((c) => c.health === 0)).toBe(true);
  await page.reload();
  await resume(page);
  const ownerId = fallen.cards.find((c) => c.id === fallen.battle!.hand[0])!.ownerId;
  const outgoing = fallen.team.find((c) => c.id === ownerId)!;
  await page.getByRole("button", { name: "Swap", exact: true }).click();
  await page
    .getByRole("button", { name: `${species(outgoing.species).name}, deployed`, exact: true })
    .click();
  await page.getByRole("button", { name: "Silkmoth, reserve", exact: true }).click();
  await expect(page.locator(".app:not([inert]) .hand .action-card").first()).toBeVisible();
  const restored = await state(page);
  expect(restored.battle!.mana).toBe(4);
  expect(restored.battle!.hand).toEqual(fallen.battle!.hand);
  await page.getByRole("button", { name: "Swap", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `${species(outgoing.species).name}, reserve`, exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("recruitment at five requires replacement and updates a released starter's lineup entry", async ({
  page,
}) => {
  const fixture = produce(winBattle(), (d) => {
    d.wins = 1;
    d.unlocked.push("moonhart");
    d.roster.push("silkmoth", "moonhart");
    d.reserves = ["silkmoth", "moonhart"].map((kind) => ({
      id: `recruit-${kind}`,
      species: kind as "silkmoth" | "moonhart",
      health: 20,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
  });
  await seed(page, fixture);
  await resume(page);
  await page.getByRole("button", { name: "Recruit Briartooth", exact: true }).click();
  expect((await state(page)).roster).toEqual(fixture.roster);
  await expect(page.getByRole("heading", { name: "Replace a creature", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(page)).revision).toBe(fixture.revision);
  await page.getByRole("button", { name: "Recruit Briartooth", exact: true }).click();
  await page.getByRole("button", { name: "Release Mossback", exact: true }).click();
  const recruited = await state(page);
  expect(recruited.roster).toHaveLength(5);
  expect(recruited.roster).not.toContain("mossback");
  expect(recruited.team.find((c) => c.id === recruited.lineup[0])!.species).toBe("briartooth");
  expect(recruited.phase).toBe("teamSelection");
  await page.reload();
  await resume(page);
  expect((await state(page)).lineup).toEqual(recruited.lineup);
});

for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`stacked creature inspection browses action cards in one dialog with ${input}`, async ({ page }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    const fixture = run(7);
    await seed(page, fixture);
    await resume(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    await activate(page.getByRole("button", { name: "Inspect Emberfox", exact: true }));
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".inspection-thumbnails .action-card")).toHaveCount(3);
    await expect(dialog.locator(".card-details")).toHaveCount(0);
    const reveal = async (el: Locator) => {
      if (input === "mouse") await el.hover();
      else await el.focus();
    };
    await reveal(dialog.locator(".creature-card"));
    await expect(page.getByRole("tooltip")).toContainText("Kindling");
    const thumbs = dialog.locator(".inspection-thumbnails .action-card");
    if (input === "mouse") {
      await thumbs.first().hover();
      await expect(page.getByRole("tooltip")).toContainText("Cinder Strike");
      await thumbs.first().click();
    } else {
      await thumbs.first().focus();
      if (press) await press(2);
      else await page.keyboard.press("i");
    }
    await expect(page.locator(".inspection")).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Back", exact: true })).toBeFocused();
    await expect(dialog.locator(".card-details")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Previous action|Next action/ })).toHaveCount(0);
    await reveal(dialog.locator(".action-card"));
    await expect(page.getByRole("tooltip")).toContainText("Cinder Strike");
    if (input === "mouse") {
      await dialog.getByRole("button", { name: "Back", exact: true }).click();
      await thumbs.nth(1).click();
    } else if (press) await press(15);
    else await page.keyboard.press("d");
    await reveal(dialog.locator(".action-card"));
    await expect(page.getByRole("tooltip")).toContainText("Warm Embers");
    if (input === "mouse") await dialog.getByRole("button", { name: "Back", exact: true }).click();
    else if (press) await press(1);
    else await page.keyboard.press("Escape");
    await expect(dialog.locator(".inspection-thumbnails .action-card").nth(1)).toBeFocused();
    if (input === "mouse") await dialog.getByRole("button", { name: "Close inspection" }).click();
    else if (press) await press(1);
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inspect Emberfox", exact: true })).toBeFocused();
    expect(await state(page)).toEqual(fixture);
  });

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`inspection preserves artwork ratios, enemy kit separation, and fit at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await seed(page, run(7));
    await resume(page);
    await page.locator(".app:not([inert]) .player-row .creature-card").first().hover();
    await expect(page.getByRole("tooltip")).toContainText("Guard cards grant 2 extra block.");
    await expect(page.getByRole("tooltip")).not.toContainText("Bramble Bash");
    await page.getByRole("button", { name: "Inspect Bramble Imp", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".card-details")).toHaveCount(0);
    await dialog.locator(".creature-card").hover();
    await expect(page.getByRole("tooltip")).toContainText("Bramble Imp");
    await expect(page.getByRole("tooltip")).toContainText("Species kit · Briartooth");
    await expect(page.getByRole("tooltip")).toContainText(
      "Start each battle with 2 Thorns. When an attack removes Health, retaliate with current Thorns, then lose 1 stack.",
    );
    await dialog
      .locator("img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await page.mouse.move(0, 0);
    await fits(page);
    const root = (await dialog.boundingBox())!;
    expect(root.y).toBeGreaterThanOrEqual(0);
    expect(root.y + root.height).toBeLessThanOrEqual(height);
    const creature = (await dialog.locator(".creature-card").boundingBox())!;
    expect(Math.abs(creature.width / creature.height - 4 / 3)).toBeLessThan(0.01);
    for (const thumb of await dialog.locator(".action-card").all()) {
      const bounds = (await thumb.boundingBox())!;
      expect(Math.abs(bounds.width / bounds.height - 3 / 4)).toBeLessThan(0.01);
      expect(await thumb.textContent()).toBe("");
    }
    await captureScreen(page, { path: `reports/inspection/live-creature-${width}.png` });
    await dialog.locator(".action-card").first().click();
    const portrait = (await dialog.locator(".action-card").boundingBox())!;
    expect(Math.abs(portrait.width / portrait.height - 3 / 4)).toBeLessThan(0.01);
    await captureScreen(page, { path: `reports/inspection/live-action-${width}.png` });
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  for (const enlarged of [false, true])
    test(`shared Reward anchors and three recruit choices at ${width}, enlarged ${enlarged}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const anchors: { heading: number }[] = [];
      for (const fixture of [winBattle(), bossReward()]) {
        await seed(page, fixture);
        await resume(page);
        if (enlarged)
          await page.locator("html").evaluate((el) => el.style.setProperty("--text-scale", "1.25"));
        await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
        await page
          .locator(".reward-screen img")
          .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
        const cards = page.locator(".reward-option");
        await expect(cards).toHaveCount(3);
        await expect(page.locator(".reward-heading h2")).toHaveCount(0);
        await expect(page.locator(".reward-choice-content > h2")).toHaveCount(1);
        const first = (await cards.first().boundingBox())!,
          last = (await cards.last().boundingBox())!;
        expect(Math.abs(first.x + last.x + last.width - width)).toBeLessThan(1);
        anchors.push({
          heading: (await page.locator(".reward-heading").boundingBox())!.y,
        });
        if (fixture.phase === "recruit") {
          await expect(page.getByRole("heading", { name: "Choose a Recruit", exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
          await page.getByRole("button", { name: "Recruit Emberfox", exact: true }).click();
          expect((await state(page)).roster.filter((kind) => kind === "emberfox")).toHaveLength(2);
        } else await page.getByRole("button", { name: "Skip", exact: true }).click();
      }
      expect(Math.abs(anchors[0]!.heading - anchors[1]!.heading)).toBeLessThan(1);
    });

for (const [width, height] of [
  [1280, 720],
  [1280, 800],
  [1920, 1080],
  [2560, 1080],
  [3440, 1440],
] as const)
  test(`bounded battle and inspection remain scroll-free at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fixture = produce(run(), (d) => {
      d.battle!.hand = d.cards.slice(0, 7).map((card) => card.id);
      d.battle!.buffer = d.cards.slice(7).map((card) => card.id);
      d.battle!.draw = [];
      d.battle!.discard = [];
    });
    await seed(page, fixture);
    await resume(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const area = (element: HTMLElement) => element.offsetWidth * element.offsetHeight;
    expect(
      await page
        .locator(".app:not([inert]) .player-row .creature-card")
        .first()
        .evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
    ).toEqual(
      height <= 760
        ? { width: 235, height: 176 }
        : height <= 900
          ? { width: 264, height: 198 }
          : { width: 293, height: 220 },
    );
    expect(
      await page
        .locator(".app:not([inert]) .hand .action-card")
        .first()
        .evaluate((el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })),
    ).toEqual(
      height <= 760
        ? { width: 144, height: 192 }
        : height <= 900
          ? { width: 162, height: 216 }
          : { width: 180, height: 240 },
    );
    expect(
      await page
        .locator(".mana-gem")
        .first()
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBe(18);
    const mana = (await page.getByRole("button", { name: /^Mana / }).boundingBox())!;
    const end = (await page.getByRole("button", { name: /^End turn/ }).boundingBox())!;
    const swap = (await page.getByRole("button", { name: "Swap", exact: true }).boundingBox())!;
    expect(swap.y + swap.height).toBeLessThan(end.y);
    expect(Math.abs(swap.x - end.x)).toBeLessThan(1);
    {
      expect(mana.x).toBe(32);
      expect(Math.abs(mana.y + mana.height - height + 24)).toBeLessThan(1);
      expect(Math.abs(end.x + end.width - width + 32)).toBeLessThan(1);
      expect(Math.abs(end.y + end.height - height + 24)).toBeLessThan(1);
    }
    await page.mouse.move(0, 0);
    const fan = await page
      .locator(".app:not([inert]) .hand-slot")
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()));
    expect(Math.abs(fan[0]!.top - fan[6]!.top)).toBeLessThan(1);
    expect(Math.abs(fan[1]!.top - fan[5]!.top)).toBeLessThan(1);
    expect(fan[0]!.top).toBeGreaterThan(fan[1]!.top);
    expect(fan[1]!.top).toBeGreaterThan(fan[2]!.top);
    {
      expect(fan[0]!.bottom).toBeGreaterThan(height);
      expect(fan[0]!.bottom).toBeLessThan(height + 64);
      expect(Math.abs(fan[3]!.bottom - height)).toBeLessThan(1);
    }
    const creatureArea = await page
      .locator(".app:not([inert]) .player-row .creature-card")
      .first()
      .evaluate(area);
    for (const card of await page.locator(".app:not([inert]) .hand .action-card").all())
      expect(Math.abs((await card.evaluate(area)) / creatureArea - (0.9 / 1.1) ** 2)).toBeLessThan(0.025);
    for (const control of await page.locator(".app:not([inert]) .hand-toolbar button:enabled").all()) {
      const bounds = (await control.boundingBox())!;
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      expect(
        await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
    const opener = page.locator(".app:not([inert]) .player-row .creature-card").first();
    await opener.click();
    const dialog = page.getByRole("dialog");
    const inspectedArea = await dialog.locator(".creature-card").evaluate(area);
    for (const card of await dialog.locator(".action-card").all())
      expect(Math.abs((await card.evaluate(area)) / inspectedArea - 1)).toBeLessThan(0.025);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
