import { captureScreen } from "./rendered-evidence";
import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { createGame } from "../../src/game/engine";
import { TALENTS, KEYWORDS } from "../../src/game/progression";
import { run } from "../support/game";
import { seed, state, resume } from "./support/session";
import { fits } from "./support/layout";

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
  if (!(await later.isVisible())) await page.getByRole("button", { name: "Next page" }).click();
  await expect(later).toHaveAttribute("aria-disabled", "true");
  const before = (await state(page)).revision;
  await later.focus();
  await page.keyboard.press("Enter");
  expect((await state(page)).revision).toBe(before);
  if (!(await page.getByRole("button", { name: "Melting Point", exact: true }).isVisible()))
    await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "Melting Point", exact: true }).click();
  await page.getByRole("button", { name: "Flashpoint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Flashpoint, unlocked", exact: true })).toBeFocused();
  expect((await state(page)).talents).toHaveLength(3);
  if (!(await later.isVisible())) await page.getByRole("button", { name: "Next page" }).click();
  await expect(later).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText("1 point available", { exact: true })).toBeVisible();
  const reset = page.getByRole("button", { name: "Reset Burn talents", exact: true });
  await reset.click();
  expect((await state(page)).talents).toEqual(["block.second-wind"]);
  expect((await state(page)).keywordXP.burn).toBe(100);
  await expect(reset).toBeDisabled();
  await expect(page.getByRole("button", { name: "Flashpoint", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(burn).toBeFocused();
  await expect(burn).toHaveAccessibleDescription("3 points available");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Pause menu" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
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
      await expect(cards).toHaveCount(KEYWORDS.length);
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
        const rows = new Map<number, number>();
        for (const art of arts) {
          const top = Math.round(art.getBoundingClientRect().top);
          rows.set(top, (rows.get(top) ?? 0) + 1);
        }
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
            return Math.abs(box.width / box.height - 0.75) < 0.01 && box.height >= 44;
          }),
          rows: [...rows.values()],
          compactColumns: categories.every((category, index) => {
            if (index % 5 === 0) return true;
            const previous = categories[index - 1]!.getBoundingClientRect();
            const current = category.getBoundingClientRect();
            const overview = screen.querySelector(".talent-overview")!;
            const gap = parseFloat(getComputedStyle(overview).columnGap);
            return Math.abs(current.left - previous.right - gap) < 1;
          }),
        };
      });
      expect(layout).toEqual({
        noScroll: true,
        captionsVisible: true,
        readableCaptions: true,
        portraitSizes: true,
        rows: [5, 5, 5],
        compactColumns: true,
      });
      const artworkFit = await page.locator(".talent-overview-viewport").evaluate((viewport) => {
        const category = viewport.querySelector(".talent-category")!;
        const art = category.querySelector(".action-card")!.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(category.querySelector(".action-card")!).marginBottom);
        const captions = Math.max(
          ...[...viewport.querySelectorAll(".talent-category")].map((item) =>
            [...item.querySelectorAll("h2, p")].reduce(
              (height, caption) => height + caption.getBoundingClientRect().height,
              0,
            ),
          ),
        );
        const rowGap = parseFloat(getComputedStyle(viewport.querySelector(".talent-overview")!).rowGap);
        return {
          actual: art.width,
          largest: Math.min(
            category.getBoundingClientRect().width,
            ((viewport.clientHeight - rowGap * 2) / 3 - captions - gap) * 0.75,
          ),
        };
      });
      expect(artworkFit.actual).toBeCloseTo(artworkFit.largest, 0);
      await captureScreen(page, {
        path: `reports/implementation/talents-overview-${width}-${height}-${scale}.png`,
      });
      expect((await state(page)).revision).toBe(fixture.revision);
    }
  });
