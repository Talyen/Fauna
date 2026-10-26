import { createBattleActor } from "../../src/application/battle-actor";
import { expect, type Locator } from "@playwright/test";
import { definition, species } from "../../src/game/content";
import { policy, FULL_JOURNEY_SEED, FULL_JOURNEY_COMMAND_BUDGET } from "../support/game";
import { test, seed, state } from "./support/session";
import { continueToRecruit, step } from "./support/journey";

test("main menu, draft and pre-battle deck lead into the first battle", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Begin journey" })).toHaveCount(0);
  const chosen = (await state(page)).starterOffers[0]!;
  const name = species(chosen).name;
  await page.getByRole("button", { name: `Recruit ${name}`, exact: true }).click();
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
  await activate(page.getByRole("button", { name: `Recruit ${name}`, exact: true }));
  expect((await state(page)).team.map((unit) => unit.id)).toEqual(["ally-0"]);
  let deployedThree = false;
  const actor = createBattleActor();
  for (let i = 0; i < FULL_JOURNEY_COMMAND_BUDGET; i++) {
    const s = await state(page);
    deployedThree ||= s.team.length === 3;
    if (s.phase === "victory") break;
    expect(s.phase).not.toBe("defeat");
    expect(s.reward?.outcome).not.toBe("defeat");
    if (s.phase === "recruit" && s.team.length + s.reserves.length < 5) {
      await continueToRecruit(page, activate);
      const roster = [...s.team, ...s.reserves];
      const incoming =
        s.reward!.recruits.find((kind) => !roster.some((unit) => unit.species === kind)) ??
        s.reward!.recruits[0]!;
      await activate(
        page
          .getByRole("button", {
            name: `Recruit ${species(incoming).name}`,
            exact: true,
          })
          .first(),
      );
      const recruited = await state(page);
      const nextRoster = [...recruited.team, ...recruited.reserves];
      const repeated = roster.some((unit) => unit.species === incoming);
      expect(nextRoster).toHaveLength(roster.length + (repeated ? 0 : 1));
      expect(nextRoster.map((unit) => unit.id)).toEqual(
        expect.arrayContaining(roster.map((unit) => unit.id)),
      );
      expect(nextRoster.filter((unit) => !roster.some((old) => old.id === unit.id))).toMatchObject(
        repeated ? [] : [{ species: incoming }],
      );
      expect(recruited.discovery.recruited[incoming]).toBe((s.discovery.recruited[incoming] ?? 0) + 1);
    } else await step(page, activate, s, s.phase === "battle" ? actor.choose(s).command : policy(s));
  }
  await expect(page.getByRole("heading", { name: "Journey complete", exact: true })).toBeVisible();
  const final = await state(page);
  expect(deployedThree).toBe(true);
  expect(final.team).toHaveLength(species(final.team[0]!.species).legendary ? 1 : 3);
});
