import { expect, it } from "vitest";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { TALENTS } from "../../../src/game/content";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { requireBattle, teamRun } from "../../support/game";

it.each([
  ["bleed.parting-cut", "partingCut"],
  ["physical.riposte", "riposte"],
  ["nature.windstep", "freeNature"],
] as const)("Dodge does not prepare %s after Footwork's reactions knock out its owner", (talent, field) => {
  for (const knockout of [true, false]) {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "bloomquail"])));
    state.boons = ["yarrow-salve-tin", "orbit-armillary", "story-puzzle-cube"];
    state.battle.puzzleProgress = ["burn", "poison"];
    const selected = ["block.footwork", talent].map((id) => TALENTS.find((entry) => entry.id === id)!);
    state.talents = TALENTS.filter((entry) =>
      selected.some(
        (choice) => entry.keyword === choice.keyword && (entry.row < choice.row || entry.id === choice.id),
      ),
    ).map((entry) => entry.id);
    for (const choice of selected) state.keywordXP[choice.keyword] = 1_000_000;
    const recipient = state.team[0]!;
    const dodger = state.team[1]!;
    const attacker = state.battle.enemies[0]!;
    recipient.health = 1;
    recipient.combat = { ...freshCombat(), bleed: 1, deathDoorUsed: true };
    recipient.combat.statusSources.bleed = attacker.id;
    dodger.health = 1;
    dodger.combat = { ...freshCombat(), deathDoorUsed: knockout };
    attacker.combat = { ...freshCombat(), armor: 1 };
    expect(decodeSave(encodeSave(state))).toEqual(state);
    observeDecisions(state, () => 0.99);
    hit(state, attacker, dodger, 1, "water", [], { origin: "ability", blindMiss: true });
    expect(dodger.health).toBe(knockout ? 0 : 1);
    expect(dodger.combat[field]).toBe(!knockout);
    expect(state.battleXP.dodge).toBe(1);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  }
});

it.each([
  "failed /Users/private-user\nretrying",
  "network failure: Basic cHJpdmF0ZTpwYXNzd29yZA==",
  "Authorization: Basic Pzo/",
  "network failure: Bearer private/token/secret",
])("redacts sensitive details in diagnostic messages: %s", (message) => {
  let stored = "";
  const diagnostics = createDiagnostics({
    read: () => null,
    write: (value) => {
      stored = value;
    },
  });
  diagnostics.record("global", message);
  for (const value of ["private-user", "cHJpdmF0ZTpwYXNzd29yZA==", "Pzo/", "private/token/secret"]) {
    expect(diagnostics.snapshot()[0]!.message).not.toContain(value);
    expect(stored).not.toContain(value);
  }
});

it("keeps ordinary uses of Basic in diagnostic messages", () => {
  const diagnostics = createDiagnostics();
  diagnostics.record("global", "Basic settings are unavailable");
  expect(diagnostics.snapshot()[0]!.message).toBe("Basic settings are unavailable");
});
