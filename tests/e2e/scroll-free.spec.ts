import { KEYWORDS, keywordLabel } from "../../src/game/progression";
import { test, expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { run } from "../support/game";
import { SPECIES } from "../../src/game/content";
import { decodeSave, encodeSave } from "../../src/game/save";
import { expectScrollFree, layoutViolations, LAYOUT_CASES } from "./layout-contract";
import { captureScreen } from "./rendered-evidence";
import { snapshot, cloudName } from "../../src/application/cloud";

// Each action is local and immediate; do not spend a full journey timeout on a missing control.
test.use({ actionTimeout: 5000 });

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
] as const)
  test(`automatic cloud recovery and desktop Settings fit ${width}×${height} with enlarged text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
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
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expectScrollFree(page);
    await captureScreen(page, { path: `reports/scroll-free/cloud-${width}.png` });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expectScrollFree(page);
    await captureScreen(page, { path: `reports/scroll-free/cloud-settings-${width}.png` });
  });

async function everyPage(root: Locator, check: () => Promise<void>) {
  for (let count = 0; count < 100; count++) {
    await check();
    const next = root.getByRole("button", { name: "Next page", exact: true });
    if (!(await next.count()) || (await next.isDisabled())) return;
    await next.click();
  }
  throw new Error("Pagination did not terminate");
}

for (const [width, height, scale] of LAYOUT_CASES)
  test(`scroll-free screens at ${width}×${height}, text ${scale}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: scale === 1 ? "no-preference" : "reduce" });
    const game = produce(run(7), (draft) => {
      draft.discovery.encountered = SPECIES.map((entry) => entry.id);
      draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
      draft.battle!.hand = draft.cards.slice(0, 7).map((card) => card.id);
      draft.battle!.buffer = draft.cards.slice(7).map((card) => card.id);
      draft.battle!.draw = [];
      draft.battle!.discard = [];
    });
    const save = encodeSave(game);
    expect(decodeSave(save)).toEqual(game);
    await page.addInitScript(
      ({ save, scale }) => {
        localStorage.setItem("fauna.save.v1", save);
        localStorage.setItem("fauna.text-scale", String(scale));
        localStorage.setItem("fauna.tooltip-scale", "1.25");
      },
      { save, scale },
    );
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    await captureScreen(page, { path: `reports/scroll-free/home-${width}-${height}-${scale}.png` });
    await page.getByRole("button", { name: "Collection", exact: true }).click();
    await captureScreen(page, { path: `reports/scroll-free/collection-${width}-${height}-${scale}.png` });
    // Exhaust the authored catalog at the most constrained size. Other cases
    // cover responsive layout with the first and last visible entries.
    const exhaustive = width === 1280 && height === 720 && scale === 1.25;
    const seen = new Set<string>();
    await everyPage(page.locator(".collection-screen"), async () => {
      await page.mouse.move(0, 0);
      await expectScrollFree(page);
      const cards = page.locator(".collection-grid .creature-card");
      const count = await cards.count();
      const indices = exhaustive
        ? Array.from({ length: count }, (_, index) => index)
        : [...new Set([0, count - 1])];
      for (const index of indices) {
        const card = cards.nth(index);
        seen.add((await card.getAttribute("aria-label"))!);
        await card.click();
        const details = page.locator(".collection-creature-screen");
        await expect(details.locator(".collection-ability")).toHaveCount(3);
        await expectScrollFree(page);
        await captureScreen(page, {
          path: `reports/scroll-free/kit-${(await card.getAttribute("data-species"))!}-${width}-${height}-${scale}.png`,
        });
        await details.getByRole("tab", { name: "Rank progression", exact: true }).click();
        await everyPage(details, () => expectScrollFree(page));
        await page.keyboard.press("Escape");
        await expect(card).toBeFocused();
      }
    });
    if (exhaustive) expect(seen.size).toBe(SPECIES.length);
    else expect(seen.size).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name: "Talents", exact: true }).click();
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
      await captureScreen(page, {
        path: `reports/scroll-free/settings-${name}-${width}-${height}-${scale}.png`,
      });
    }
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.mouse.move(0, 0);
    await expectScrollFree(page);
    await page.mouse.wheel(500, 500);
    await page.keyboard.press("Tab");
    await expectScrollFree(page);
    expect(await page.locator(".battle-screen").evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([
      0, 0,
    ]);
    // The authored fan is the sole clipping exception; every card still needs a real hit target.
    const hand = page.locator(".app:not([inert]) .hand .action-card");
    await expect(hand).toHaveCount(7);
    for (const card of await hand.all()) {
      const point = await card.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        for (let y = Math.max(0, rect.top) + 8; y < Math.min(innerHeight, rect.bottom); y += 12)
          for (let x = Math.max(0, rect.left) + 8; x < Math.min(innerWidth, rect.right); x += 12)
            if (el.contains(document.elementFromPoint(x, y))) return { x, y };
        return null;
      });
      expect(point).not.toBeNull();
      await page.mouse.click(point!.x, point!.y);
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expectScrollFree(page);
      await page.keyboard.press("Escape");
      await expect(card).toHaveAttribute("aria-pressed", "false");
    }
    await page.mouse.move(0, 0);
    await captureScreen(page, { path: `reports/scroll-free/battle-${width}-${height}-${scale}.png` });
    await page.getByRole("button", { name: "Inspect Draw Pile" }).click();
    await expectScrollFree(page);
  });

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
