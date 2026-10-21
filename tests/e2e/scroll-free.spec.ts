import { KEYWORDS, keywordLabel } from "../../src/game/progression";
import { test, expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { run } from "../unit/helpers";
import { SPECIES } from "../../src/game/content";
import { encodeSave } from "../../src/game/save";
import { expectScrollFree, layoutViolations } from "./layout-contract";
import { captureScreen } from "./rendered-evidence";
import { snapshot, cloudName } from "../../src/application/cloud";

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
] as const)
  test(`cloud conflict and desktop Settings fit ${width}×${height} with enlarged text`, async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: "Choose a save" })).toBeVisible();
    const choices = new Set<string>();
    await everyPage(page.locator(".recovery"), async () => {
      await expectScrollFree(page);
      choices.add(await page.getByRole("button", { name: /^Use save/ }).innerText());
    });
    expect(choices.size).toBeGreaterThanOrEqual(2);
    await captureScreen(page, { path: `reports/scroll-free/cloud-${width}.png` });
    await page.getByRole("button", { name: "Play offline" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Steam Cloud" }).click();
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

for (const [width, height] of [
  [1280, 720],
  [1280, 800],
  [1920, 1080],
  [2560, 1080],
  [3440, 1440],
])
  for (const scale of [1, 1.25])
    test(`scroll-free screens at ${width}×${height}, text ${scale}`, async ({ page }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.emulateMedia({ reducedMotion: scale === 1 ? "no-preference" : "reduce" });
      const game = produce(run(7), (draft) => {
        draft.discovery.recruited = Object.fromEntries(SPECIES.map((entry) => [entry.id, 1]));
        draft.battle!.hand = draft.cards.slice(0, 7).map((card) => card.id);
        draft.battle!.buffer = draft.cards.slice(7).map((card) => card.id);
        draft.battle!.draw = [];
        draft.battle!.discard = [];
      });
      await page.addInitScript(
        ({ save, scale }) => {
          localStorage.setItem("fauna.save.v1", save);
          localStorage.setItem("fauna.text-scale", String(scale));
          localStorage.setItem("fauna.tooltip-scale", "1.25");
        },
        { save: encodeSave(game), scale },
      );
      await page.goto("/");
      await expectScrollFree(page);
      await page.getByRole("button", { name: "Collection", exact: true }).click();
      const seen = new Set<string>();
      await everyPage(page.locator(".collection-screen"), async () => {
        await page.mouse.move(0, 0);
        await expectScrollFree(page);
        const cards = page.locator(".collection-grid .creature-card");
        for (let index = 0; index < (await cards.count()); index++) {
          const card = cards.nth(index);
          seen.add((await card.getAttribute("aria-label"))!);
          await card.click();
          const dialog = page.locator(".creature-inspection");
          await everyPage(dialog, () => expectScrollFree(page));
          const action = dialog.locator(".inspection-thumbnails .action-card").first();
          await action.click();
          await page.locator(".single-card .action-card").hover();
          await expect(page.getByRole("tooltip")).toBeVisible();
          await expectScrollFree(page);
          await page.keyboard.press("Escape");
          await expect(action).toBeFocused();
          await page.keyboard.press("Escape");
          await expect(card).toBeFocused();
        }
      });
      expect(seen.size).toBe(SPECIES.length);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("button", { name: "Talents", exact: true }).click();
      for (const keyword of KEYWORDS) {
        await page.getByRole("button", { name: `${keywordLabel(keyword)} talents`, exact: true }).click();
        await everyPage(page.locator(".talents-screen"), () => expectScrollFree(page));
        await page.getByRole("button", { name: "Back", exact: true }).click();
      }
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("button", { name: "Glossary", exact: true }).click();
      await everyPage(page.getByRole("dialog"), () => expectScrollFree(page));
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      for (const name of ["Display", "Sound", "Battle"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await expectScrollFree(page);
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
        await expectScrollFree(page);
        await page.keyboard.press("Escape");
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
