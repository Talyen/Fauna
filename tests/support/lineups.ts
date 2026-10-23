import { expect } from "vitest";
import { SPECIES, type SpeciesId } from "../../src/game/content";
import { decodeSave, encodeSave } from "../../src/game/save";
import { accept, policy, teamRun } from "./game";

export function ordinaryLineups() {
  const ordinarySpecies = SPECIES.filter((entry) => !entry.legendary);
  const scenarios: { name: string; seed: number; kinds: SpeciesId[] }[] = [];
  for (let first = 0; first < ordinarySpecies.length - 2; first++)
    for (let second = first + 1; second < ordinarySpecies.length - 1; second++)
      for (let third = second + 1; third < ordinarySpecies.length; third++) {
        const lineup = [first, second, third].map((index) => ordinarySpecies[index]!);
        scenarios.push({
          name: lineup.map((entry) => entry.name).join(", "),
          seed: first * 100 + second * 10 + third,
          kinds: lineup.map((entry) => entry.id),
        });
      }
  return scenarios;
}

/** Shared assertions keep representative and exhaustive journeys on the same contract. */
export function expectSupportedLineup({ seed, kinds }: ReturnType<typeof ordinaryLineups>[number]) {
  let s = teamRun(seed, kinds);
  for (let i = 0; i < 500 && !["victory", "defeat"].includes(s.phase); i++) {
    s = accept(s, policy(s));
    decodeSave(encodeSave(s));
  }
  // Support-heavy teams can sustain combat; their escape must still bank progress safely.
  if (!["victory", "defeat"].includes(s.phase)) {
    const progress = { ...s.keywordXP };
    const earned = { ...s.battleXP };
    s = accept(s, { type: "abandon" });
    expect(s.phase).toBe("defeat");
    expect(s.reward).toBeNull();
    expect(Object.values(s.battleXP).every((amount) => amount === 0)).toBe(true);
    for (const keyword of Object.keys(earned) as (keyof typeof earned)[])
      expect(s.keywordXP[keyword]).toBe((progress[keyword] ?? 0) + earned[keyword]!);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  }
  expect(
    ["victory", "defeat"],
    `${kinds.join(", ")} at encounter ${s.encounter}, turn ${s.battle?.turn}`,
  ).toContain(s.phase);
}
