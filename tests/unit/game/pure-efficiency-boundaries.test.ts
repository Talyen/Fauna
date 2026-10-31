import { expect, it } from "vitest";
import { rosterBoonKeywords, offerBoons, passiveBoonKeywords } from "../../../src/game/boon-offers";
import {
  journeyReturnEligibility,
  journeyReturnHasDraw,
  drawHasAnotherCard,
} from "../../../src/game/card-zones";
import { shareDodge, shareNegate } from "../../../src/game/combat/damage";
import { overflowCupRecipient, overflowRecipients } from "../../../src/game/combat/healing-values";
import { mostInjured, maximumHealth } from "../../../src/game/combat/state";
import { healingAllies } from "../../../src/game/battlefield";
import { creaturePassiveTier } from "../../../src/game/progression";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";

it("keeps draw eligibility aligned with the ordered pool as owners and piles change", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const [owner, other] = state.team;
  const own = state.cards.find((card) => card.ownerId === owner!.id)!;
  const theirs = state.cards.find((card) => card.ownerId === other!.id)!;
  state.boons = ["journey-loom"];
  for (const pile of [[], [own.id], [theirs.id], [own.id, theirs.id], [theirs.id, own.id]]) {
    state.battle.draw = pile;
    for (const health of [0, 1]) {
      other!.health = health;
      const eligible = journeyReturnEligibility(state, owner!.id);
      expect(journeyReturnHasDraw(state, owner!.id)).toBe(!!eligible);
      expect(drawHasAnotherCard(state, { kind: "draw", amount: 1 })).toBe(
        pile.some((id) => id === own.id || (id === theirs.id && health > 0)),
      );
    }
  }
});

it("keeps protection recipient priority, ties, and duplicate Dodge decisions", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "reedstag"])));
  const [bearer, first, second] = state.team;
  const enemy = state.battle.enemies[0]!;
  state.boons = ["devotion-clasp", "sandfold-parasol"];
  bearer!.combat!.negate = true;
  first!.health = 1;
  second!.health = 1;
  const candidates = [first!, second!];
  expect(shareNegate(state, enemy, [bearer!, ...candidates], false)?.recipientId).toBe(
    mostInjured(candidates)?.id,
  );
  first!.combat!.negate = true;
  expect(shareNegate(state, enemy, [bearer!, ...candidates], false)?.recipientId).toBe(second!.id);
  second!.combat!.negate = true;
  expect(shareNegate(state, enemy, [bearer!, ...candidates], false)?.recipientId).toBe(
    mostInjured(candidates)?.id,
  );
  first!.combat!.negate = false;
  const decisions: unknown[] = [];
  observeDecisions(state, (decision) => {
    decisions.push(decision);
    return 0.99;
  });
  shareDodge(state, enemy, [first!, first!], [], false);
  expect(decisions).toHaveLength(1);
});

it("preserves overflow recipients and their ordering as health and grace change", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "reedstag"])));
  const actor = state.team[0]!;
  for (const unit of state.team.slice(1)) {
    unit.health = 1;
    unit.combat!.grace = 1;
  }
  const expected = healingAllies(state).filter(
    (ally) => ally.id !== actor.id && ally.health < maximumHealth(ally),
  );
  expect(overflowCupRecipient(state, actor)).toBe(mostInjured(expected));
  expect(overflowRecipients(state, actor)).toEqual(expected.filter((ally) => (ally.combat?.grace ?? 0) > 0));
  state.team[1]!.health = maximumHealth(state.team[1]!);
  state.team[2]!.combat!.grace = 0;
  expect(overflowRecipients(state, actor)).toEqual([]);
});

it("keeps Boon keyword results independent and observes current passive rank", () => {
  const state = structuredClone(teamRun(42, ["mossguard", "prismram"]));
  const expected = [...rosterBoonKeywords(state)];
  rosterBoonKeywords(state).clear();
  expect([...rosterBoonKeywords(state)]).toEqual(expected);
  const seed = state.rng;
  expect(offerBoons(state, 0)).toEqual([]);
  expect(state.rng).toBe(seed);
  state.discovery.recruited.mossguard = 6;
  const ranked = [...rosterBoonKeywords(state)];
  expect([...rosterBoonKeywords(state)]).toEqual(ranked);
  const injected = structuredClone(creaturePassiveTier(state, "mossguard"));
  injected.effects = [{ kind: "battleStart", effect: "block", amount: 1 }];
  expect(passiveBoonKeywords(injected)).toEqual(["block"]);
  injected.effects = [{ kind: "battleStart", effect: "armor", amount: 1 }];
  expect(passiveBoonKeywords(injected)).toEqual(["armor"]);
});
