import { expectTalentOverview } from "./support/layout";
import { KEYWORDS, keywordLabel } from "../../src/game/progression";
import { expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { CARDS, definition } from "../../src/game/content";
import { run, teamRun } from "../support/game";
import { SPECIES } from "../../src/game/content";
import { encodeSave } from "../../src/game/save";
import { expectScrollFree, layoutViolations, LAYOUT_CASES } from "./support/layout-contract";
import { openHome, test, seed, state } from "./support/session";
import { expectBattleGeometry } from "./support/battle-layout";
import { captureFrame, captureScreen, settleScreen } from "./support/rendered-evidence";
import { snapshot, cloudName } from "../../src/application/cloud-snapshots";

test("automatic cloud recovery and desktop Settings fit both sizes with enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const identity = {
    available: true,
    device: "a".repeat(32),
    profile: "b".repeat(32),
    importAvailable: false,
  };
  const remote = await Promise.all(
    [8, 9].map((seed) =>
      snapshot(encodeSave(run(seed)), { ...identity, device: String(seed).repeat(32) }, 1),
    ),
  );
  const files = Object.fromEntries(remote.map((entry) => [cloudName(entry), JSON.stringify(entry)]));
  await page.addInitScript(
    ({ identity, files, save }) => {
      localStorage.setItem("fauna.text-scale", "1.25");
      window.faunaDesktop = {
        readCandidates: async () => [{ source: "local", data: save }],
        writeSave: async () => {},
        quit: async () => {},
        onCloseRequested: () => () => {},
        cloud: {
          identity: async () => identity,
          readLocal: async () => null,
          writeLocal: async () => {},
          preserve: async () => {},
          importStandalone: async () => [],
          list: async () => Object.keys(files),
          read: async (name) => files[name] ?? null,
          write: async (name, data) => {
            files[name] = data;
          },
        },
      };
    },
    { identity, files, save: encodeSave(run(7)) },
  );
  await openHome(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 1080 });
    await captureScreen(page, { path: `reports/scroll-free/cloud-${width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 1080 });
    await captureScreen(page, { path: `reports/scroll-free/cloud-settings-${width}.png` });
  }
});

async function everyPage(root: Locator, check: (page: number) => Promise<void>) {
  for (let count = 0; count < 100; count++) {
    await check(count);
    const next = root.getByRole("button", { name: "Next page", exact: true });
    if (!(await next.count()) || (await next.isDisabled())) return;
    await next.click();
  }
  throw new Error("Pagination did not terminate");
}

function layoutGame(targetedHand = false) {
  const game = produce(targetedHand ? teamRun(7, ["prismram", "emberback", "reedstag"]) : run(7), (draft) => {
    draft.keywordXP.burn = 100;
    draft.discovery.encountered = SPECIES.map((entry) => entry.id);
    draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
    if (targetedHand) {
      draft.discovery.recruited.prismram = 3;
      const attacks = draft.cards.filter(
        (card) => definition(card.definitionId).effect === "attack" && !definition(card.definitionId).target,
      );
      while (attacks.length < 6) {
        const copy = { ...attacks[0]!, id: `copy-${draft.battle!.copySerial++}`, temporary: true as const };
        draft.cards.push(copy);
        attacks.push(copy);
      }
    }
    const cards = targetedHand
      ? draft.cards.filter((card) => {
          const def = definition(card.definitionId);
          return def.effect === "attack" && !def.target;
        })
      : draft.cards;
    draft.battle!.hand = cards.slice(0, 6).map((card) => card.id);
    draft.battle!.draw = draft.cards
      .filter((card) => !draft.battle!.hand.includes(card.id))
      .map((card) => card.id);
    draft.battle!.buffer = [];
    draft.battle!.discard = [draft.battle!.draw.pop()!];
  });
  return game;
}

for (const [width, height, scale] of LAYOUT_CASES) {
  test.describe(`scroll-free at ${width}×${height}, text ${scale}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: scale === 1 ? "no-preference" : "reduce" });
      await page.addInitScript((scale) => {
        localStorage.setItem("fauna.text-scale", String(scale));
        localStorage.setItem("fauna.tooltip-scale", "1.25");
      }, scale);
    });

    test("Collection and rank pages", async ({ page }) => {
      await seed(page, layoutGame());
      await captureScreen(page, { path: `reports/scroll-free/home-${width}-${height}-${scale}.png` });
      await page.getByRole("button", { name: "Collection", exact: true }).click();
      await captureScreen(page, { path: `reports/scroll-free/collection-${width}-${height}-${scale}.png` });
      // Exhaust the authored catalog at the most constrained size. Other cases
      // cover every grid page, but open only the first and last catalog entries.
      const exhaustive = width === 1280 && height === 720 && scale === 1.25;
      const seen = new Set<string>();
      await everyPage(page.locator(".collection-screen"), async (pageIndex) => {
        await page.mouse.move(0, 0);
        await expectScrollFree(page);
        const cards = page.locator(".collection-grid .creature-card");
        const count = await cards.count();
        const lastPage = await page.getByRole("button", { name: "Next page", exact: true }).isDisabled();
        const indices = exhaustive
          ? Array.from({ length: count }, (_, index) => index)
          : [...new Set([...(pageIndex === 0 ? [0] : []), ...(lastPage ? [count - 1] : [])])];
        for (const index of indices) {
          const card = cards.nth(index);
          const kind = (await card.getAttribute("data-species"))!;
          seen.add(kind);
          await card.click();
          const details = page.locator(".creature-inspection");
          await expect(details.locator(".inspection-thumbnails .action-card")).toHaveCount(3);
          await settleScreen(page);
          await details
            .locator("img")
            .evaluateAll((images) =>
              Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
            );
          await expectScrollFree(page);
          const abilities = details.locator(".action-card");
          const portraits = await abilities.evaluateAll((cards) =>
            cards.map((card) => {
              const box = card.getBoundingClientRect();
              return { ratio: box.width / box.height, text: card.textContent };
            }),
          );
          for (const portrait of portraits) {
            expect(portrait.ratio).toBeCloseTo(3 / 4, 2);
            expect(portrait.text).toBe("");
          }
          if (kind === SPECIES[0]!.id && (exhaustive || width === 1920)) {
            await expect(details.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
            for (const action of CARDS.filter((card) => card.species === kind)) {
              await details.getByRole("button", { name: new RegExp(`^${action.name},`) }).hover();
              await expect(page.getByRole("tooltip")).toContainText(action.name);
              await expect(page.getByRole("tooltip").locator(".action-effect")).not.toBeEmpty();
            }
            await page.mouse.move(0, 0);
            await settleScreen(page);
          }
          // Every kit retains rendered checks; representative frames avoid a PNG per catalog entry.
          if (kind === SPECIES[0]!.id || kind === SPECIES.at(-1)!.id)
            await captureFrame(page, {
              path: `reports/scroll-free/kit-${kind}-${width}-${height}-${scale}.png`,
            });
          await expect(details.locator(".creature-card")).toHaveCount(0);
          await expect(details.getByRole("region", { name: "Trait", exact: true })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(card).toBeFocused();
        }
      });
      expect([...seen]).toEqual(
        (exhaustive ? SPECIES : [SPECIES[0]!, SPECIES.at(-1)!]).map((entry) => entry.id),
      );
    });

    test("Talents, Glossary and Settings", async ({ page }) => {
      await seed(page, layoutGame());
      const exhaustive = width === 1280 && height === 720 && scale === 1.25;
      const before = await state(page);
      await page.getByRole("button", { name: "Talents", exact: true }).click();
      await page.mouse.move(0, 0);
      await settleScreen(page);
      await expectTalentOverview(page);
      await expect(
        page.getByRole("button", { name: "Burn talents", exact: true }),
      ).toHaveAccessibleDescription("3 points available");
      await captureScreen(page, { path: `reports/scroll-free/talents-${width}-${height}-${scale}.png` });
      for (const keyword of exhaustive ? KEYWORDS : [KEYWORDS[0]!, KEYWORDS.at(-1)!]) {
        await page.getByRole("button", { name: `${keywordLabel(keyword)} talents`, exact: true }).click();
        if (keyword === KEYWORDS[0])
          await captureScreen(page, {
            path: `reports/scroll-free/talent-tree-${width}-${height}-${scale}.png`,
          });
        await everyPage(page.locator(".talents-screen"), () => expectScrollFree(page));
        await page.keyboard.press("Escape");
      }
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await page.getByRole("button", { name: "Glossary", exact: true }).click();
      await captureScreen(page, { path: `reports/scroll-free/glossary-${width}-${height}-${scale}.png` });
      await everyPage(page.getByRole("main", { name: "Glossary & controls" }), () => expectScrollFree(page));
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      for (const name of ["Display", "Sound", "Battle"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        const panel = page.getByRole("tabpanel");
        await expect(panel).toBeVisible();
        if (exhaustive && name === "Sound") {
          for (const slider of await panel.locator(".ui-slider").all()) {
            const bounds = (await slider.boundingBox())!;
            expect(bounds.width).toBeGreaterThanOrEqual(88);
            await slider.click({ position: { x: bounds.width * 0.75, y: bounds.height / 2 } });
            await expect
              .poll(async () => Number(await slider.getByRole("slider").getAttribute("aria-valuenow")))
              .toBeGreaterThan(50);
          }
        }
        await captureScreen(page, {
          path: `reports/scroll-free/settings-${name}-${width}-${height}-${scale}.png`,
        });
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
      expect(await state(page)).toEqual(before);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
    });

    test("battle hand and draw pile", async ({ page }) => {
      // Targeted cards exercise every real hit target without committing a play and reloading
      await seed(page, layoutGame(true));
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      const before = await state(page);
      await page.mouse.move(0, 0);
      await expectScrollFree(page);
      await expectBattleGeometry(page, width, height);
      if (width === 1280 && height === 720 && scale === 1.25) {
        const widths = await page
          .locator(".player-row .creature-card")
          .first()
          .evaluate(
            (card) =>
              new Promise<number[]>((resolve) => {
                const samples: number[] = [];
                const sample = () => {
                  samples.push(card.getBoundingClientRect().width);
                  if (samples.length < 30) requestAnimationFrame(sample);
                  else resolve(samples);
                };
                requestAnimationFrame(sample);
              }),
          );
        expect(new Set(widths).size, "Creature artwork must not oscillate after layout settles").toBe(1);
      }

      await page.mouse.wheel(500, 500);
      await page.keyboard.press("Tab");
      await expectScrollFree(page);
      expect(await page.locator(".battle-screen").evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([
        0, 0,
      ]);
      // The authored fan is the sole clipping exception; every card still needs a real hit target.
      const hand = page.locator(".app:not([inert]) .hand .action-card");
      await expect(hand).toHaveCount(6);
      for (const card of await hand.all()) {
        // Escape changes selection immediately; the previous card can still be lowering over this one.
        await page.mouse.move(0, 0);
        await settleScreen(page);
        const hitPoint = () =>
          card.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            for (let y = Math.max(0, rect.top) + 8; y < Math.min(innerHeight, rect.bottom); y += 12)
              for (let x = Math.max(0, rect.left) + 8; x < Math.min(innerWidth, rect.right); x += 12)
                if (
                  [-8, 0, 8].every((dx) =>
                    [-8, 0, 8].every((dy) => el.contains(document.elementFromPoint(x + dx, y + dy))),
                  )
                )
                  return { x, y };
            return null;
          });
        let point = await hitPoint();
        expect(point).not.toBeNull();
        await page.mouse.move(point!.x, point!.y);
        await settleScreen(page);
        // Hover lifts the fan card; click its settled position rather than its old silhouette.
        point = await hitPoint();
        expect(point).not.toBeNull();
        await page.mouse.click(point!.x, point!.y);
        await expect(card).toHaveAttribute("aria-pressed", "true");
        await expectScrollFree(page);
        await page.keyboard.press("Escape");
        await expect(card).toHaveAttribute("aria-pressed", "false");
      }
      expect(await state(page)).toEqual(before);
      await page.mouse.move(0, 0);
      await captureScreen(page, { path: `reports/scroll-free/battle-${width}-${height}-${scale}.png` });
      const opener = page.getByRole("button", { name: "Inspect Draw Pile" });
      await opener.click();
      const pile = page.getByRole("dialog", { name: "Draw Pile", exact: true });
      const card = pile.locator(".action-card").first();
      await expect(card).toBeVisible();
      if (width === 1280 && height === 720 && scale === 1.25) {
        await card.click();
        await card.hover();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await card.focus();
        await page.keyboard.press("i");
        await expect(page.getByRole("dialog")).toHaveCount(1);
      }
      await everyPage(pile, () => expectScrollFree(page));
      await page.getByRole("button", { name: "Close draw pile" }).click();
      await expect(opener).toBeFocused();
      await page.getByRole("button", { name: "Inspect Discard Pile" }).click();
      await expect(page.getByRole("dialog", { name: "Discard Pile" }).locator(".action-card")).toHaveCount(1);
      if ((width === 1280 && height === 720 && scale === 1.25) || width === 1920)
        await captureScreen(page, { path: `reports/scroll-free/discard-${width}-${height}-${scale}.png` });
      else await expectScrollFree(page);
      expect(await state(page)).toEqual(before);
    });
  });
}

test("layout enforcement detects nested scrolling, hidden clipping, and obscured controls", async ({
  page,
}) => {
  await page.setContent(
    '<main class="app"><div id="list" style="height:80px;overflow:auto"><p style="height:200px">Rules</p></div></main>',
  );
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("scroll area"))).toBe(true);
  await page.locator("#list").evaluate((el) => {
    el.style.overflow = "hidden";
  });
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("clipped content"))).toBe(
    true,
  );
  await page.setContent(
    '<main class="app"><button style="height:44px">Play</button><div style="position:fixed;inset:0"></div></main>',
  );
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("obscured"))).toBe(true);
});

test("layout enforcement rejects controls with an obscured edge even when their center is clear", async ({
  page,
}) => {
  await page.setContent(
    '<main class="app"><button style="width:160px;height:44px">Discard Pile</button><div style="position:fixed;left:148px;top:8px;width:20px;height:44px"></div></main>',
  );
  expect((await page.evaluate(layoutViolations)).some((entry) => entry.includes("obscured"))).toBe(true);
});

test("layout enforcement checks the content center inside a full-height screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(
    '<div class="app"><div class="screen-stage" style="height:600px;display:flex;align-items:center"><main style="width:100%;height:100%"><h1 style="margin:0;height:40px">Settings</h1></main></div></div>',
  );
  expect(
    (await page.evaluate(layoutViolations)).some((entry) => entry.includes("not vertically centered")),
  ).toBe(true);
  await page.locator("main").evaluate((el) => {
    el.style.display = "flex";
    el.style.alignItems = "center";
  });
  expect((await page.evaluate(layoutViolations)).filter((entry) => entry.includes("centered"))).toEqual([]);
  await page.locator("main").evaluate((el) => {
    el.style.width = "50%";
  });
  expect(
    (await page.evaluate(layoutViolations)).some((entry) => entry.includes("not horizontally centered")),
  ).toBe(true);
});
