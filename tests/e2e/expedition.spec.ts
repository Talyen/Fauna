import { test, expect, type Page, type Locator } from "@playwright/test";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import { definition, species } from "../../src/game/content";
import type { GameState } from "../../src/game/types";
import { accept, policy, winBattle, run } from "../unit/helpers";
async function seed(page: Page, state = createGame(7)) {
  await page.addInitScript((data) => localStorage.setItem("fauna.save.v1", data), JSON.stringify(state));
}
async function saved(page: Page) {
  await expect(page.locator(".app")).toHaveAttribute("data-save-status", "saved");
}
async function state(page: Page): Promise<GameState> {
  await saved(page);
  return page.evaluate(() => JSON.parse(localStorage.getItem("fauna.save.v1")!));
}
async function draft(page: Page) {
  for (const name of ["Mossback", "Emberfox", "Stormfin"])
    await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page.getByRole("main", { name: "Battle 1" })).toBeVisible();
}
async function playStep(
  page: Page,
  activate: (target: Locator) => Promise<void> = (target) => target.click(),
) {
  const s = await state(page);
  const command = policy(s);
  if (command.type === "upgrade") {
    const def = definition(s.cards.find((c) => c.id === command.cardId)!.definitionId);
    await activate(page.getByRole("button", { name: `Upgrade ${def.name}`, exact: true }));
  } else if (command.type === "play") {
    await activate(page.locator(`[data-card-id="${command.cardId}"]`));
    await expect(page.locator(".app")).toHaveAttribute("data-selected-card", command.cardId);
    if (command.targetId) {
      const name = command.targetId.startsWith("enemy")
        ? s.battle!.enemies.find((e) => e.id === command.targetId)!.name
        : species(s.team.find((c) => c.id === command.targetId)!.species).name;
      await activate(page.getByRole("button", { name: `Target ${name}`, exact: true }));
    } else await activate(page.getByRole("button", { name: /^Play ·/ }));
  } else await activate(page.getByRole("button", { name: "End turn" }));
}
test("complete draft-to-boss journey, upgrade, unlock, and durable resume", async ({ page }) => {
  await seed(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.screenshot({ path: "reports/draft-1280.png", fullPage: true });
  await draft(page);
  for (let i = 0; i < 150; i++) {
    const s = await state(page);
    if (s.phase === "victory") break;
    expect(s.phase).not.toBe("defeat");
    await playStep(page);
  }
  await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
  await page.screenshot({ path: "reports/victory-1280.png", fullPage: true });
  const won = await state(page);
  expect(won.wins).toBe(1);
  expect(won.unlocked).toContain("moonhart");
  // A real reload must use persisted state rather than the initialization fixture.
  page.removeAllListeners("pageerror");
  const fresh = await page.context().newPage();
  await fresh.goto("/");
  await expect(fresh.getByRole("heading", { name: "Victory" })).toBeVisible();
  await fresh.getByRole("button", { name: "New run" }).click();
  await expect(fresh.getByRole("button", { name: "Choose Moonhart", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("recruitment replaces cards and survives closing the page during feedback", async ({
  page,
  context,
}) => {
  await seed(page, winBattle());
  await page.goto("/");
  await page.screenshot({ path: "reports/reward-1280.png", fullPage: true });
  await page.getByRole("button", { name: "Recruit Silkmoth", exact: true }).click();
  await page.getByRole("button", { name: "Replace Mossback", exact: true }).click();
  await saved(page);
  await page.screenshot({ path: "reports/three-enemies-1280.png", fullPage: true });
  const before = await state(page);
  expect(before.team[0]!.species).toBe("silkmoth");
  expect(before.cards.some((c) => c.definitionId.startsWith("mossback"))).toBe(false);
  await page.close();
  const resumed = await context.newPage();
  await resumed.goto("/");
  await expect(resumed.getByRole("main", { name: "Battle 2" })).toBeVisible();
  expect((await state(resumed)).revision).toBe(before.revision);
});
test("keyboard targeting, enlarged inspection, cancel, and menu focus", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await draft(page);
  const card = page.locator('.hand .action-card[data-effect="attack"]').first();
  await card.focus();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cancel-target")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("main", { name: "Pause menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "Battle 1" })).toBeVisible();
});
test("standard gamepad edge handling, navigation, inspect, confirm, and back", async ({ page }) => {
  await seed(page, run(7));
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { mapping: "standard", buttons, axes: [0, 0, 0, 0] };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  await page.goto("/");
  await expect(page.getByRole("main", { name: "Battle 1" })).toBeVisible();
  const press = async (index: number) => {
    await page.evaluate((i) => {
      (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
        true;
    }, index);
    await page.waitForTimeout(80);
    await page.evaluate((i) => {
      (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
        false;
    }, index);
    await page.waitForTimeout(40);
  };
  const card = page.locator('.hand .action-card[data-effect="attack"]').first();
  await card.focus();
  await press(2);
  await expect(page.getByRole("dialog")).toBeVisible();
  await press(1);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(card).toBeFocused();
  await press(0);
  await expect(page.locator(".app")).toHaveAttribute("data-input", "controller");
  await press(1);
  await press(1);
  await expect(page.getByRole("main", { name: "Pause menu" })).toBeVisible();
  await press(0);
  await press(15);
  await expect(page.getByRole("main", { name: "Battle 1" })).toBeVisible();
});
test("handheld and desktop composition preserve artwork, rows, hand, and readable inspection", async ({
  page,
}) => {
  await seed(page, run(7));
  await page.goto("/");
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    const enemies = await page.getByRole("region", { name: "Enemy row" }).boundingBox();
    const players = await page.getByRole("region", { name: "Player row" }).boundingBox();
    const hand = await page.getByRole("region", { name: "Action hand" }).boundingBox();
    expect(enemies!.y + enemies!.height).toBeLessThan(players!.y);
    expect(players!.y + players!.height).toBeLessThan(hand!.y);
    expect(hand!.y + hand!.height).toBeLessThanOrEqual(size.height);
    const landscape = await page.locator(".player-row .creature-card").first().boundingBox();
    const portrait = await page.locator(".hand .action-card").first().boundingBox();
    expect(landscape!.width / landscape!.height).toBeCloseTo(4 / 3, 1);
    expect(portrait!.width / portrait!.height).toBeCloseTo(3 / 4, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: `reports/battle-${size.width}.png`, fullPage: true });
  }
  await page.locator(".hand .action-card").first().focus();
  await page.keyboard.press("i");
  await page.screenshot({ path: "reports/inspection.png", fullPage: true });
});
test("combat tokens, local font and modal focus remain readable and isolated", async ({ page }) => {
  await seed(page, run(7));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".app")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  expect(
    await page.evaluate(() =>
      [...document.fonts].some((font) => font.family.includes("Inter Variable") && font.status === "loaded"),
    ),
  ).toBe(true);
  await expect(page.locator(".health-number").first()).toHaveCSS("color", "rgb(248, 113, 113)");
  await expect(page.locator('[data-damage-type="nature"]').first()).toHaveCSS("color", "rgb(52, 211, 153)");
  await expect(page.locator('[data-damage-type="fire"]').first()).toHaveCSS("color", "rgb(251, 146, 60)");
  await page.locator('.hand .action-card[data-effect="teamGuard"]').first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip").locator('[data-combat-tone="block"]').first()).toHaveCSS(
    "color",
    "rgb(125, 211, 252)",
  );
  const card = page.locator(".hand .action-card").first();
  const before = await state(page);
  await card.focus();
  await page.keyboard.press("i");
  await expect(page.getByRole("button", { name: "Close inspection" })).toBeFocused();
  await page.keyboard.press("s");
  await expect(page.getByRole("button", { name: "Close inspection" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close inspection" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
  expect((await state(page)).revision).toBe(before.revision);
});
test("corrupt primary recovers backup; all invalid saves require explicit recovery", async ({ page }) => {
  await page.addInitScript(
    (data) => {
      localStorage.setItem("fauna.save.v1", "broken");
      localStorage.setItem("fauna.save.v1.backup1", data);
    },
    JSON.stringify(run(7)),
  );
  await page.goto("/");
  await expect(page.getByText("Recovered your expedition from a backup.")).toBeVisible();
  await expect(page.getByRole("main", { name: "Battle 1" })).toBeVisible();
});
test("controller-equivalent draft-to-boss journey and held-confirm protection", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const pad = {
      mapping: "standard",
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Choose Mossback", exact: true })).toBeFocused();
  const press = async (index: number, duration = 45) => {
    await page.evaluate((i) => {
      (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
        true;
    }, index);
    await page.waitForTimeout(duration);
    await page.evaluate((i) => {
      (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
        false;
    }, index);
    await page.waitForTimeout(30);
  };
  await press(0, 400);
  expect((await state(page)).selected).toEqual(["mossback"]);
  await press(15);
  await press(0);
  await press(15);
  await press(0);
  expect((await state(page)).selected).toEqual(["mossback", "emberfox", "stormfin"]);
  await press(13);
  await expect(page.getByRole("button", { name: "Start run" })).toBeFocused();
  await press(0);
  for (let i = 0; i < 150; i++) {
    const s = await state(page);
    if (s.phase === "victory") break;
    expect(s.phase).not.toBe("defeat");
    await playStep(page, async (target) => {
      await target.focus();
      await press(0);
    });
  }
  await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
  expect((await state(page)).wins).toBe(1);
});
test("combat committed during feedback resumes once after immediate page close", async ({
  page,
  context,
}) => {
  await seed(page, run(7));
  await page.goto("/");
  const before = await state(page);
  const attack = before.cards.find(
    (c) => before.battle!.hand.includes(c.id) && definition(c.definitionId).effect === "attack",
  )!;
  await page.locator(`[data-card-id="${attack.id}"]`).click();
  await page.getByRole("button", { name: "Target Bramble Imp", exact: true }).click();
  await page.close();
  const resumed = await context.newPage();
  await resumed.goto("/");
  const after = await state(resumed);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.battle!.energy).toBe(before.battle!.energy - 1);
  expect(after.battle!.discard).toContain(attack.id);
  expect(after.battle!.enemies[0]!.health).toBeLessThan(before.battle!.enemies[0]!.health);
});
test("explicit all-invalid recovery and failed browser writes retain the live expedition", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("fauna.save.v1", "broken");
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Save unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Start fresh" }).click();
  await expect(page.getByRole("button", { name: "Choose Mossback", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Choose Mossback", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await expect(page.getByRole("button", { name: "Choose Mossback", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("the expanded roster keeps three recruitment choices inside their panel", async ({ page }) => {
  const reward = JSON.parse(JSON.stringify(winBattle())) as GameState;
  reward.unlocked.push("moonhart");
  reward.wins = 1;
  await seed(page, reward);
  await page.goto("/");
  await expect(page.locator(".recruit-options .creature-card")).toHaveCount(3);
  const panel = await page.locator(".reward-columns section").first().boundingBox();
  for (const card of await page.locator(".recruit-options .creature-card").all()) {
    const box = await card.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(panel!.x + panel!.width + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("art-only cards expose rules through hover and focus without overlays", async ({ page }) => {
  await seed(page, run(7));
  await page.goto("/");
  expect(
    await page
      .locator(".creature-card, .action-card")
      .evaluateAll((cards) =>
        cards.every(
          (card) =>
            card.children.length === 1 &&
            card.firstElementChild?.tagName === "IMG" &&
            card.textContent === "",
        ),
      ),
  ).toBe(true);
  const card = page.locator('.hand .action-card[data-effect="attack"]').first();
  await card.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("1 energy");
  await expect(page.getByRole("tooltip")).toContainText("damage");
  await page.getByRole("tooltip").hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await card.focus();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toContainText("1 energy");
  await page.screenshot({ path: "reports/art-only-inspection-1280.png" });
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
});
test("A/D previews, wraps and confirms exact outcomes without spending on selection", async ({ page }) => {
  await seed(page, run(7));
  await page.goto("/");
  const before = await state(page);
  const attack = before.cards.find(
    (c) => before.battle!.hand.includes(c.id) && definition(c.definitionId).effect === "attack",
  )!;
  await page.locator(`[data-card-id="${attack.id}"]`).click();
  await expect(page.locator('[data-enemy-id="enemy-0"]')).toBeFocused();
  await expect(page.getByRole("status", { name: "Target preview" })).toBeVisible();
  expect(await state(page)).toEqual(before);
  await page.keyboard.press("d");
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  await page.keyboard.press("d");
  await expect(page.locator('[data-enemy-id="enemy-0"]')).toBeFocused();
  await page.keyboard.press("a");
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  const previewBox = await page.getByRole("status", { name: "Target preview" }).boundingBox();
  const confirmBox = await page.locator(".confirm-play").boundingBox();
  expect(previewBox!.y + previewBox!.height).toBeLessThanOrEqual(confirmBox!.y);
  await page.screenshot({ path: "reports/target-preview-1280.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(`[data-card-id="${attack.id}"]`)).toBeFocused();
  expect(await state(page)).toEqual(before);
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  await page.keyboard.press("Enter");
  const after = await state(page);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.battle!.energy).toBe(before.battle!.energy - 1);
  await expect(page.locator('[data-actor-id="enemy-1"] .combat-burst')).toBeVisible();
  await page.screenshot({ path: "reports/floating-feedback-1280.png" });
  await page.waitForTimeout(1600);
  await expect(page.locator(".combat-burst")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("main", { name: "Battle 1" })).toBeVisible();
  await expect(page.locator(".combat-burst")).toHaveCount(0);
});
test("team-wide cards preview and require confirmation", async ({ page }) => {
  await seed(page, run(7));
  await page.goto("/");
  const before = await state(page);
  await page.locator('.hand .action-card[data-effect="teamGuard"]').first().click();
  await expect(page.getByRole("status", { name: "Target preview" })).toHaveCount(3);
  expect(await state(page)).toEqual(before);
  await page.keyboard.press("Enter");
  const after = await state(page);
  expect(after.team.every((c) => c.block === 5)).toBe(true);
  expect(after.battle!.energy).toBe(2);
  await expect(page.locator(".block-badge")).toHaveCount(3);
});
test("glossary, controls and enlarged text stay usable and persist independently", async ({ page }) => {
  await seed(page, run(7));
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Glossary & controls" }).click();
  await expect(page.getByRole("dialog")).toContainText("A/D cycles valid targets");
  await expect(page.getByRole("dialog")).toContainText("Marks");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Glossary & controls" })).toBeFocused();
  await page.getByRole("button", { name: "Text size 100%" }).click();
  await page.getByRole("button", { name: "Text size 125%" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.locator(".hand .action-card").first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip").locator(".action-effect")).toHaveCSS("font-size", "24px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "reports/text-150-1280.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Text size 150%" })).toBeVisible();
});

test("target cycling skips knockouts and announces a lethal preview", async ({ page }) => {
  const fixture = produce(run(7), (d) => {
    d.battle!.enemies[0]!.health = 0;
    d.battle!.enemies[1]!.health = 1;
  });
  await seed(page, fixture);
  await page.goto("/");
  await page.locator('.hand .action-card[data-effect="attack"]').first().click();
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  await expect(page.getByRole("status", { name: "Target preview" })).toContainText("Knockout");
  await page.keyboard.press("a");
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  await page.keyboard.press("d");
  await expect(page.locator('[data-enemy-id="enemy-1"]')).toBeFocused();
  expect(await state(page)).toEqual(fixture);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Recruit", exact: true })).toBeVisible();
});

test("tooltips show adjusted final values and navigation follows battle rows", async ({ page }) => {
  const fixture = produce(run(7), (d) => {
    const attack = d.cards.find((c) => c.definitionId === "emberfox-attack")!;
    attack.level = 1;
    const guard = d.cards.find((c) => c.definitionId === "mossback-teamGuard")!;
    d.battle!.hand = [attack.id, guard.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== attack.id && c.id !== guard.id).map((c) => c.id);
    d.battle!.discard = [];
  });
  await seed(page, fixture);
  await page.goto("/");
  const attack = page.locator('.hand [data-effect="attack"]');
  await attack.focus();
  await expect(page.getByRole("tooltip")).toContainText("Deal 12 Fire damage.");
  await page.keyboard.press("w");
  expect(await page.locator(".player-row").evaluate((row) => row.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("w");
  expect(await page.locator(".enemy-row").evaluate((row) => row.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("s");
  expect(await page.locator(".player-row").evaluate((row) => row.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("s");
  expect(await page.locator(".hand").evaluate((row) => row.contains(document.activeElement))).toBe(true);
  await page.locator('.hand [data-effect="teamGuard"]').focus();
  await expect(page.getByRole("tooltip")).toContainText("Give every living ally 5 block");
  await attack.click();
  await page.getByRole("button", { name: "Target Bramble Imp", exact: true }).click();
  await page.locator('.player-row [data-species="emberfox"]').focus();
  await expect(page.getByRole("tooltip")).toContainText("Deal 10 Fire damage.");
});
test("enemy feedback appears in short sequential attacks after immediate commitment", async ({ page }) => {
  const fixture = produce(run(7), (d) => {
    d.battle!.enemies[0]!.targetId = "ally-0";
    d.battle!.enemies[1]!.targetId = "ally-1";
  });
  await seed(page, fixture);
  await page.goto("/");
  await page.getByRole("button", { name: "End turn" }).click();
  const committed = await state(page);
  expect(committed.battle!.turn).toBe(2);
  expect(committed.team[0]!.health).toBe(28);
  expect(committed.team[1]!.health).toBe(20);
  await expect(page.locator('[data-actor-id="ally-0"] .combat-burst')).toBeVisible();
  await expect(page.locator('[data-actor-id="ally-1"] .combat-burst')).toHaveCount(0);
  await expect(page.locator('[data-actor-id="ally-1"] .combat-burst')).toBeVisible();
});

test("three enemies with block forecasts keep the hand inside the handheld viewport", async ({ page }) => {
  const reward = winBattle(run(7));
  const second = accept(reward, { type: "upgrade", cardId: reward.cards[0]!.id });
  const fixture = produce(second, (d) => {
    d.team.forEach((c) => (c.block = 5));
    d.battle!.enemies.forEach((e, i) => (e.targetId = `ally-${i}`));
  });
  await seed(page, fixture);
  await page.goto("/");
  await expect(page.locator(".intent-block")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "reports/block-forecasts-1280.png", fullPage: true });
});

test("closing during the enemy sequence resumes its committed turn without replay", async ({
  page,
  context,
}) => {
  await seed(page, run(7));
  await page.goto("/");
  const before = await state(page);
  await page.getByRole("button", { name: "End turn" }).click();
  await page.close();
  const resumed = await context.newPage();
  await resumed.goto("/");
  const after = await state(resumed);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.battle!.turn).toBe(before.battle!.turn + 1);
  await expect(resumed.locator(".combat-burst")).toHaveCount(0);
  await resumed.waitForTimeout(700);
  await expect(resumed.locator(".combat-burst")).toHaveCount(0);
});
