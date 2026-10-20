import { test, expect, type Page, type Locator } from "@playwright/test";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import { definition, species } from "../../src/game/content";
import { RELICS } from "../../src/game/progression";
import type { GameState } from "../../src/game/types";
import { accept, policy, winBattle, run } from "../unit/helpers";
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
  await expect(page.locator(".app")).toHaveAttribute("data-save-status", "saved");
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
  if (c.type === "beginBattle")
    await activate(page.getByRole("button", { name: "Begin battle", exact: true }));
  else if (c.type === "continueReward")
    await activate(page.getByRole("button", { name: "Continue", exact: true }));
  else if (c.type === "skipRecruit") await activate(page.getByRole("button", { name: "Skip", exact: true }));
  else if (c.type === "chooseRelic")
    await activate(
      page.getByRole("button", {
        name: `Choose ${RELICS.find((r) => r.id === c.relic)!.name}`,
        exact: true,
      }),
    );
  else if (c.type === "play") {
    await activate(page.locator(`.hand [data-card-id="${c.cardId}"]`));
    if (c.targetId) {
      const name = c.targetId.startsWith("enemy-")
        ? s.battle!.enemies.find((e) => e.id === c.targetId)!.name
        : species(s.team.find((a) => a.id === c.targetId)!.species).name;
      await activate(page.getByRole("button", { name: `Target ${name}`, exact: true }));
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
    await page.waitForTimeout(45);
    await page.evaluate(
      (i) =>
        ((window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[i]!.pressed =
          false),
      index,
    );
    await page.waitForTimeout(25);
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

test("main menu, draft and pre-battle deck lead into the first battle", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("button", { name: "New expedition", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "New expedition", exact: true }).click();
  for (const name of ["Mossback", "Emberfox", "Stormfin"])
    await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "Start expedition" }).click();
  expect((await state(page)).phase).toBe("teamSelection");
  await page.getByRole("button", { name: "Inspect Bramble Imp", exact: true }).focus();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog").getByText("Bramble Imp", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Deck", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".action-card")).toHaveCount(9);
  await page.getByRole("dialog").locator(".action-card").first().click({ button: "right" });
  await expect(page.getByRole("dialog").last().locator(".card-details")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
});
for (const input of ["mouse", "keyboard", "controller"] as const)
  test(`complete expedition through separate rewards with ${input}`, async ({ page }) => {
    const press = input === "controller" ? await gamepad(page) : null;
    await seed(
      page,
      produce(createGame(7), (d) => {
        d.selected = ["mossback"];
      }),
    );
    await resume(page);
    const activate = async (el: Locator) => {
      if (input === "mouse") await el.click();
      else {
        await el.focus();
        if (press) await press(0);
        else await page.keyboard.press("Enter");
      }
    };
    for (const name of ["Emberfox", "Stormfin"])
      await activate(page.getByRole("button", { name: `Choose ${name}`, exact: true }));
    await activate(page.getByRole("button", { name: "Start expedition" }));
    for (let i = 0; i < 180; i++) {
      const s = await state(page);
      if (s.phase === "victory") break;
      expect(s.phase).not.toBe("defeat");
      expect(s.reward?.outcome).not.toBe("defeat");
      await step(page, activate);
    }
    await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
    const won = await state(page);
    expect(won.wins).toBe(1);
    expect(won.unlocked).toContain("moonhart");
    expect(won.currency).toBe(80);
    expect(Object.values(won.keywordXP).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    expect((await state(page)).revision).toBe(won.revision);
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await expect(page.getByRole("button", { name: "Inspect Moonhart" })).toBeVisible();
  });
test("recruitment adds a reserve, selection swaps its kit, and remembers active choices", async ({
  page,
}) => {
  await seed(page, winBattle());
  await resume(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Recruit Briartooth", exact: true }).click();
  expect((await state(page)).roster).toHaveLength(4);
  expect((await state(page)).phase).toBe("relic");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const active = page.getByRole("button", { name: "Mossback, active", exact: true }),
    reserve = page.getByRole("button", { name: "Briartooth, reserve", exact: true });
  await active.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("s");
  await expect(reserve).toBeFocused();
  await page.keyboard.press("Enter");
  const s = await state(page);
  expect(s.team[0]!.species).toBe("briartooth");
  await expect(page.getByRole("button", { name: "Briartooth, active", exact: true })).toBeFocused();
  expect(s.cards.some((c) => c.definitionId.startsWith("mossback"))).toBe(false);
  await page.reload();
  await resume(page);
  await expect(page.getByRole("button", { name: "Briartooth, active", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Begin battle" }).click();
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
  const cards = page.locator(".hand .action-card");
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
  await expect(page.getByRole("button", { name: /^Mana \d of 3$/ })).toBeVisible();
});
test("talents purchase immediately, gate rows, reset a category, and return to the paused battle", async ({
  page,
}) => {
  const fixture = produce(run(7), (d) => {
    d.keywordXP = { fire: 420, block: 20 };
  });
  await seed(page, fixture);
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  await page.getByRole("tab", { name: "Fire", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shelter", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Potency", exact: true }).click();
  await page.getByRole("button", { name: "Mastery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shelter", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Shelter", exact: true }).click();
  expect((await state(page)).talents).toHaveLength(3);
  await page.getByRole("button", { name: "Reset category", exact: true }).click();
  expect((await state(page)).talents).toEqual([]);
  expect((await state(page)).keywordXP.fire).toBe(420);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  expect((await state(page)).battle).toEqual(fixture.battle);
});
test("Collection hides locked tooltips and uses centered unlocked inspection", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  const locked = page.getByRole("img", { name: "Locked species" });
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
test("settings and glossary return to the pause menu; End run requires confirmation", async ({ page }) => {
  await seed(page, run());
  await resume(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("switch", { name: "Sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Glossary & controls" })).toBeVisible();
  await page.keyboard.press("Escape");
  const before = await state(page);
  await page.getByRole("button", { name: "End run", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "End expedition?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("alertdialog", { name: "End expedition?" })).toBeVisible();
  expect((await state(page)).revision).toBe(before.revision);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(page)).phase).toBe("battle");
  await page.getByRole("button", { name: "End run", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "End expedition?" })
    .getByRole("button", { name: "End run", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "New expedition", exact: true })).toBeVisible();
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
  await page.locator(".hand .action-card").click();
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
test("rewards resume without duplicate XP, currency, recruitment or relics", async ({ page }) => {
  const fixture = winBattle();
  await seed(page, fixture);
  await resume(page);
  await page.reload();
  await resume(page);
  expect((await state(page)).currency).toBe(fixture.currency);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const before = await state(page);
  await page.reload();
  await resume(page);
  const relic = page.locator(".relic-choice").first();
  await relic.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Enter");
  const after = await state(page);
  expect(after.currency).toBe(before.currency);
  expect(after.keywordXP).toEqual(before.keywordXP);
  expect(after.relics).toHaveLength(1);
  await page.reload();
  await resume(page);
  expect((await state(page)).relics).toEqual(after.relics);
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
  await expect(page.getByRole("button", { name: "New expedition", exact: true })).toBeVisible();
});
test("controller edges, inspect and pause do not repeat a held confirm", async ({ page }) => {
  const press = await gamepad(page);
  await seed(page, run());
  await resume(page);
  const card = page.locator('.hand .action-card[data-effect="attack"]').first();
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
      d.keywordXP.fire = 420;
    });
    await seed(page, fixture);
    await resume(page);
    await page.mouse.move(0, 0);
    await page
      .locator(".creature-card img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await fits(page);
    const creature = await page.locator(".player-row .creature-card").first().boundingBox();
    for (const card of await page.locator(".hand .action-card").all()) {
      const box = await card.boundingBox();
      expect(Math.abs(box!.height - creature!.height)).toBeLessThan(1);
      await expect(card.locator("img")).toHaveAttribute("width", "600");
    }
    await page.screenshot({ path: `reports/implementation/battle-${width}.png` });
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Talents", exact: true }).click();
    await fits(page);
    await page.getByRole("tab", { name: "Fire", exact: true }).click();
    await page.waitForTimeout(180);
    await page.screenshot({ path: `reports/implementation/talents-${width}.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await fits(page);
    await page
      .locator(".collection-grid img")
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    await page.screenshot({ path: `reports/implementation/collection-${width}.png` });
    let reward = winBattle(fixture);
    await seed(page, reward);
    await resume(page);
    await fits(page);
    await page.screenshot({ path: `reports/implementation/rewards-${width}.png` });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    if ((await state(page)).phase === "recruit")
      await page.getByRole("button", { name: "Skip", exact: true }).click();
    await fits(page);
    await page.screenshot({ path: `reports/implementation/relic-${width}.png` });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await fits(page);
    await page.screenshot({ path: `reports/implementation/team-${width}.png` });
  });

test("real audio output, hit recoil, reduced motion, and mute follow combat outcomes", async ({ page }) => {
  await page.addInitScript(() => {
    const observed = { peak: 0, contexts: [] as AudioContext[], impacts: [] as string[] };
    Object.assign(window, { combatObserved: observed });
    const Native = window.AudioContext;
    class ObservedAudio extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        observed.contexts.push(this);
        const analyser = this.createAnalyser();
        analyser.connect(this.destination);
        const create = this.createGain.bind(this);
        this.createGain = () => {
          const gain = create();
          gain.connect = new Proxy(gain.connect, {
            apply: (method, receiver, args) =>
              Reflect.apply(
                method,
                receiver,
                args[0] === this.destination ? [analyser, ...args.slice(1)] : args,
              ),
          });
          return gain;
        };
        const samples = new Float32Array(analyser.fftSize);
        const timer = setInterval(() => {
          if (this.state === "closed") {
            clearInterval(timer);
            return;
          }
          analyser.getFloatTimeDomainData(samples);
          for (const sample of samples) observed.peak = Math.max(observed.peak, Math.abs(sample));
        }, 5);
      }
    }
    window.AudioContext = ObservedAudio;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches(".creature-card"))
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
  await page.locator('.hand [data-card-id="ally-0:mossback-attack"]').click();
  await page.getByRole("button", { name: "Target Bramble Imp", exact: true }).click();
  const observed = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            combatObserved: { peak: number; contexts: AudioContext[]; impacts: string[] };
          }
        ).combatObserved,
    );
  await expect.poll(async () => (await observed()).peak).toBeGreaterThan(0.001);
  expect((await observed()).impacts).toContain("enemy-0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const count = (await observed()).impacts.length;
  await page.locator('.hand [data-card-id="ally-1:emberfox-attack"]').click();
  await page.getByRole("button", { name: "Target Cinder Wisp", exact: true }).click();
  expect((await observed()).impacts).toHaveLength(count);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("switch", { name: "Sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Resume" }).click();
  const contexts = (await observed()).contexts.length;
  await page.getByRole("button", { name: "End turn" }).click();
  await page.waitForTimeout(400);
  expect((await observed()).contexts).toHaveLength(contexts);
  expect(
    await page.evaluate(() =>
      (window as unknown as { combatObserved: { contexts: AudioContext[] } }).combatObserved.contexts.every(
        (context) => context.state === "closed",
      ),
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Sound", exact: true })).not.toBeChecked();
});

test("six-card hand, three enemies and a full bench preserve fit and original artwork ratios", async ({
  page,
}) => {
  let s = winBattle();
  while (s.phase !== "teamSelection") s = accept(s, policy(s));
  s = produce(s, (d) => {
    d.relics = ["wind-feather"];
    d.wins = 1;
    d.unlocked.push("moonhart");
    d.roster = ["mossback", "emberfox", "stormfin", "silkmoth", "briartooth", "moonhart"];
  });
  await seed(page, s);
  await resume(page);
  await fits(page);
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.locator(".hand .action-card")).toHaveCount(6);
  await expect(page.locator(".enemy-row .creature-card")).toHaveCount(3);
  await fits(page);
  const h = (await page.locator(".player-row .creature-card").first().boundingBox())!.height;
  for (const card of await page.locator(".hand .action-card").all()) {
    await card.focus();
    expect(Math.abs((await card.boundingBox())!.height - h)).toBeLessThan(1);
  }
});
test("enlarged text and keyboard/controller row navigation keep inspection and menu controls reachable", async ({
  page,
}) => {
  await seed(page, run());
  await page.evaluate(() => localStorage.setItem("fauna.text-scale", "1.5"));
  await page.reload();
  await resume(page);
  const card = page.locator(".hand .action-card").first();
  await card.focus();
  await page.keyboard.press("w");
  await expect(page.locator(".player-row .creature-card:focus")).toHaveCount(1);
  await page.keyboard.press("w");
  await expect(page.locator(".enemy-row .creature-card:focus")).toHaveCount(1);
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
  await page.getByRole("button", { name: "Talents", exact: true }).click();
  const physical = page.getByRole("tab", { name: "Physical", exact: true });
  await physical.focus();
  await page.keyboard.press("ArrowRight");
  const fire = page.getByRole("tab", { name: "Fire", exact: true });
  await expect(fire).toBeFocused();
  await expect(fire).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    (await fire.getAttribute("id")) as string,
  );
  await page.keyboard.press("d");
  await expect(page.getByRole("tab", { name: "Ice", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Sound", exact: true });
  await sound.focus();
  await page.keyboard.press("Space");
  await expect(sound).not.toBeChecked();
  const small = page.getByRole("radio", { name: "100%", exact: true });
  await small.focus();
  await page.keyboard.down("ArrowDown");
  await expect(page.getByRole("radio", { name: "125%", exact: true })).toBeChecked();
  await page.keyboard.up("ArrowDown");
  await page.keyboard.press("s");
  await expect(page.getByRole("radio", { name: "150%", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "150%", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(sound).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "150%", exact: true })).toBeChecked();
});

test("End run uses alert-dialog cancellation, trapping and outside-click protection", async ({ page }) => {
  await seed(page, run());
  await page.getByRole("button", { name: "End run", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "End expedition?" });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  // Clicking the overlay may blur the focused button without dismissing.
  await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "End run", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "End run", exact: true })).toBeFocused();
  expect((await state(page)).phase).toBe("battle");
});
