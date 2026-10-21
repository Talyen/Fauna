import { KEYWORDS, keywordLabel } from "../../src/game/progression";
import { test, expect, type Locator } from "@playwright/test";
import { produce } from "immer";
import { run } from "../unit/helpers";
import { SPECIES } from "../../src/game/content";
import { encodeSave } from "../../src/game/save";
import { expectScrollFree, layoutViolations, REVIEW_VIEWPORTS } from "./layout-contract";
import { captureScreen } from "./rendered-evidence";
import { snapshot, cloudName } from "../../src/application/cloud";

for (const [width, height] of REVIEW_VIEWPORTS)
  for (const scale of [1, 1.25])
    test(`scroll-free screens at ${width}×${height}, text ${scale}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
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
