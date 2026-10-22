import { chooseBattleCommand } from "../../src/application/battle-policy";
import { test, expect, type Locator } from "@playwright/test";
import { definition, species } from "../../src/game/content";
import { policy, FULL_JOURNEY_SEED, FULL_JOURNEY_COMMAND_BUDGET } from "../support/game";
import { seed, state } from "./support/session";
import { step } from "./support/journey";

test("main menu, draft and pre-battle deck lead into the first battle", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Begin journey" })).toBeDisabled();
  const chosen = (await state(page)).starterOffers[0]!;
  const name = species(chosen).name;
  await page.getByRole("button", { name: `Inspect ${name}`, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "Begin journey" }).click();
  expect((await state(page)).phase).toBe("teamSelection");
  const destination = page.locator(".app:not([inert]) [data-encounter]").first();
  const deckCards = (await state(page)).cards;
  await page.getByRole("button", { name: "Deck", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".action-card")).toHaveCount(3);
  const inspectedCard = page.getByRole("dialog").locator(".action-card").first();
  const inspectedId = await inspectedCard.getAttribute("data-card-id");
  await inspectedCard.click({ button: "right" });
  await expect(page.locator(".inspection.single-card")).toBeVisible();
  await page.locator(".inspection.single-card .action-card").hover();
  await expect(page.getByRole("tooltip")).toContainText(
    definition(deckCards.find((card) => card.id === inspectedId)!.definitionId).name,
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await destination.click();
  await expect(page.getByRole("main", { name: "Battlefield" })).toBeVisible();
});

test("one starter grows a lineup through a full expedition", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date(FULL_JOURNEY_SEED));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  const activate = (el: Locator) => el.click();
  await activate(page.getByRole("button", { name: "Play", exact: true }));
  const chosen = (await state(page)).starterOffers[0]!;
  const name = species(chosen).name;
  await activate(page.getByRole("button", { name: `Inspect ${name}`, exact: true }));
  await activate(page.getByRole("button", { name: `Choose ${name}`, exact: true }));
  await activate(page.getByRole("button", { name: "Begin journey", exact: true }));
  expect((await state(page)).lineup).toEqual(["ally-0"]);
  for (let i = 0; i < FULL_JOURNEY_COMMAND_BUDGET; i++) {
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
    } else await step(page, activate, s, s.phase === "battle" ? chooseBattleCommand(s) : policy(s));
  }
  await expect(page.getByRole("heading", { name: "Journey complete", exact: true })).toBeVisible();
  expect((await state(page)).team).toHaveLength(3);
});
