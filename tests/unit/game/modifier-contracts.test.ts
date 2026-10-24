import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
import { modifierImplementations, modifierQueries } from "../../../src/game/modifier-bindings";
import { boonRule } from "../../../src/game/rules/boons";
import { createHash } from "node:crypto";
import { produce } from "immer";
import { expect, it } from "vitest";
import { BOONS, TALENTS, SPECIES, type SpeciesId, species } from "../../../src/game/content";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { availablePlays } from "../../../src/game/play-queries";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { encodeSave, decodeSave } from "../../../src/game/save";
import {
  hit,
  freshCombat,
  grantBlock,
  grantArmor,
  restoreHealth,
  removeEffects,
  tickStatuses,
  startAction,
} from "../../../src/game/combat/index";
import type { GameEvent } from "../../../src/game/types";
import { requireBattle, teamRun } from "../../support/game";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

// Recorded on committed main before modifier bindings or parameters changed.
// These expectations are an independent behavior oracle; do not refresh them for a refactor.
it("preserves all modifier definitions, text and ordered six-tier passives", () => {
  expect({
    talents: digest(TALENTS),
    boons: digest(BOONS),
    passives: digest(SPECIES.map(({ id, passiveTiers }) => ({ id, passiveTiers }))),
  }).toMatchSnapshot();
});

const cases = [
  ...TALENTS.map((talent) => ({
    name: talent.id,
    talent,
    boon: undefined,
    species: "mossguard" as SpeciesId,
    rank: 0,
  })),
  ...BOONS.map((boon) => ({
    name: boon.id,
    talent: undefined,
    boon,
    species: "mossguard" as SpeciesId,
    rank: 0,
  })),
  ...SPECIES.flatMap((species) =>
    Array.from({ length: 6 }, (_, rank) => ({
      name: `${species.id}:${rank}`,
      talent: undefined,
      boon: undefined,
      species: species.id,
      rank,
    })),
  ),
  {
    name: "combined reactions",
    talent: undefined,
    boon: undefined,
    species: "pollenmoth" as SpeciesId,
    rank: 5,
  },
];
it("preserves modifier command, preview, reaction, RNG and save/resume traces", () => {
  const results = cases.map((scenario) => {
    const original = teamRun(
      42,
      species(scenario.species).legendary ? [scenario.species] : [scenario.species, "reedstag", "cindernewt"],
    );
    const state = requireBattle(
      produce(original, (draft) => {
        if (scenario.talent) {
          const talent = scenario.talent;
          draft.keywordXP[talent.keyword] = 100000;
          draft.talents = TALENTS.filter(
            (other) => other.keyword === talent.keyword && (other.row < talent.row || other.id === talent.id),
          ).map((other) => other.id);
        }
        if (scenario.boon) draft.boons = [scenario.boon.id];
        draft.discovery.recruited[scenario.species] = scenario.rank + 1;
        if (scenario.name === "combined reactions") {
          draft.talents = TALENTS.map((talent) => talent.id);
          for (const talent of TALENTS) draft.keywordXP[talent.keyword] = 100000;
          draft.boons = BOONS.map((boon) => boon.id);
        }
      }),
    );
    const encoded = encodeSave(state);
    const resumed = decodeSave(encoded);
    const plays = availablePlays(state, false).flatMap((play) => play.commands);
    const commands = plays.map((command) => {
      const result = dispatch(state, { ...command, autoEndTurn: false });
      expect(dispatch(resumed, { ...command, autoEndTurn: false })).toEqual(result);
      return {
        result: digest(result),
        preview: digest(previewCard(state, command.cardId, command.targetId)),
      };
    });
    const mutable = structuredClone(state);
    const events: GameEvent[] = [];
    const actor = mutable.team[0]!;
    const target = mutable.battle.enemies[0]!;
    actor.health = 8;
    actor.block = 6;
    actor.combat = freshCombat();
    target.health = target.maxHealth = 500;
    target.combat = freshCombat();
    target.block = 5;
    target.combat.armor = 3;
    grantBlock(mutable, actor, 4, events);
    grantArmor(mutable, actor, 4, events);
    for (const type of [
      "physical",
      "water",
      "nature",
      "light",
      "burn",
      "poison",
      "bleed",
      "stun",
      "freeze",
    ] as const)
      hit(mutable, actor, target, 9, type, events);
    hit(mutable, target, actor, 8, "physical", events);
    restoreHealth(actor, 100, events, false, mutable, true, actor);
    removeEffects(actor, "cleanse", 7, events, mutable);
    tickStatuses(mutable, target, events);
    startAction(target, events, mutable);
    expect(encodeSave(state)).toBe(encoded);
    const rejected = dispatch(state, { type: "play", cardId: "missing" });
    expect(rejected.state).toBe(state);
    return {
      name: scenario.name,
      commands,
      turn: digest(dispatch(state, { type: "endTurn" })),
      ranking: digest(rankedBattleChoices(state, false)),
      reactions: digest({ mutable, events }),
    };
  });
  expect(Object.fromEntries(results.map(({ name, ...trace }) => [name, digest(trace)]))).toMatchSnapshot();
});

it("preserves initial journey and seeded start state", () => {
  expect(digest(createGame(42))).toMatchSnapshot();
});

it("requires actual implementation bindings for authored modifiers, including future content", () => {
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  expect(Object.keys(modifierImplementations.talents).sort()).toEqual(
    TALENTS.map((talent) => talent.id).sort(),
  );
  expect(Object.keys(modifierImplementations.boons).sort()).toEqual(BOONS.map((boon) => boon.id).sort());
  const authoredPassives = [
    ...new Set(
      SPECIES.flatMap((species) =>
        species.passiveTiers.flatMap((tier) => tier.effects.map((effect) => effect.kind)),
      ),
    ),
  ];
  expect(Object.keys(modifierImplementations.passives)).toEqual(expect.arrayContaining(authoredPassives));
  const talent = structuredClone(contentCatalog);
  Reflect.set(talent.talents[0]!, "id", "water.future");
  Reflect.set(talent.talents[0]!, "effect", "future");
  expect(validateCatalog(talent)).toContainEqual(
    expect.objectContaining({ id: "water.future", field: "effect", severity: "error" }),
  );
  const boon = structuredClone(contentCatalog);
  Reflect.set(boon.boons[0]!, "id", "future-boon");
  expect(validateCatalog(boon)).toContainEqual(
    expect.objectContaining({ id: "future-boon", field: "effect", severity: "error" }),
  );
  const passive = structuredClone(contentCatalog);
  Reflect.set(passive.species[0]!.passiveTiers[0].effects[0]!, "kind", "futurePassive");
  expect(validateCatalog(passive)).toContainEqual(
    expect.objectContaining({
      field: "passiveTiers",
      message: "Passive effect needs an implementation binding",
    }),
  );
});
it("keeps implementation bindings and shared Boon parameters immutable", () => {
  for (const catalog of [modifierImplementations, modifierQueries]) {
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(structuredClone(catalog)).toEqual(catalog);
    for (const group of Object.values(catalog)) {
      expect(Object.isFrozen(group)).toBe(true);
      for (const binding of Object.values(group)) {
        expect(Object.isFrozen(binding)).toBe(true);
        expect(
          binding.every(
            (handler: { module: string; name: string }) =>
              typeof handler.module === "string" &&
              typeof handler.name === "string" &&
              Object.isFrozen(handler),
          ),
        ).toBe(true);
      }
    }
  }
  const icy = boonRule("icy-heart");
  expect(Reflect.set(icy, "damage", 99)).toBe(false);
  expect(icy.text).toContain(String(icy.damage));
});
