import { createBattleActor } from "../../src/application/battle-actor";
import { expect, type Locator } from "@playwright/test";
import { species } from "../../src/game/content";
import { policy, fullJourneyRecruit, FULL_JOURNEY_SEED, FULL_JOURNEY_COMMAND_BUDGET } from "../support/game";
import { test, seed, state, reloadHome, resume } from "./support/session";
import { continueToRecruit, step } from "./support/journey";

test("one starter grows a lineup and reaches a committed journey outcome", async ({ page }) => {
  test.setTimeout(process.env.CI ? 0 : 120_000);
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
  let resumed = false;
  const actor = createBattleActor();
  for (let i = 0; i < FULL_JOURNEY_COMMAND_BUDGET; i++) {
    const s = await state(page);
    deployedThree ||= s.team.length === 3;
    if (s.phase === "victory" || s.phase === "defeat") break;
    if (s.phase === "recruit" && s.team.length + s.reserves.length < 5) {
      await continueToRecruit(page);
      const roster = [...s.team, ...s.reserves];
      const choice = fullJourneyRecruit(s);
      expect(choice.type).toBe("recruit");
      if (choice.type !== "recruit") throw new Error("Expected a recruit for an incomplete roster");
      const incoming = choice.species;
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
      if (!resumed) {
        await reloadHome(page);
        await resume(page);
        expect(await state(page)).toEqual(recruited);
        resumed = true;
      }
    } else
      await step(
        page,
        activate,
        s,
        s.phase === "battle"
          ? actor.choose(s).command
          : s.phase === "recruit"
            ? fullJourneyRecruit(s)
            : policy(s),
      );
  }
  const final = await state(page);
  expect(["victory", "defeat"]).toContain(final.phase);
  await expect(
    page.getByRole("heading", {
      name: final.phase === "victory" ? "Journey complete" : "Defeated",
      exact: true,
    }),
  ).toBeVisible();
  expect(deployedThree).toBe(true);
  expect(resumed).toBe(true);
  expect(final.journey!.victories).toBeGreaterThan(0);
  expect([...final.team, ...final.reserves].length).toBeGreaterThanOrEqual(3);
  expect(final.team.length).toBeGreaterThanOrEqual(1);
  expect(final.team.length).toBeLessThanOrEqual(species(final.team[0]!.species).legendary ? 1 : 3);
});
