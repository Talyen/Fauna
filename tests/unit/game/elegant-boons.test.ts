import { setBattleCards } from "../../support/cards";
import { expect, it } from "vitest";
import { run, requireBattle, addBackups, accept } from "../../support/game";
import { BOONS, definition, species } from "../../../src/game/content";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { observeDecisions } from "../../../src/game/random";
import { inspectCardPlay } from "../../../src/game/play-queries";
import { matchSwapBlock, swapBackup, swapFromCard } from "../../../src/game/team";
import { controlled, ownDodgeChance } from "../../../src/game/combat/state";
import { executeAbility } from "../../../src/game/combat/abilities";
import {
  freshCombat,
  hit,
  removeEffects,
  startAction,
  tickStatuses,
  applyBlind,
} from "../../../src/game/combat/index";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = requireBattle(structuredClone(run()));
  state.boons = [];
  state.talents = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  observeDecisions(state, () => 0.99);
  const source = state.team[1]!;
  const target = state.battle.enemies[0]!;
  target.health = target.maxHealth = 100;
  return { state, source, target, events: [] as GameEvent[] };
}

it("Pearl Sieve removes Block plus the ordinary Purge count, without helping allied or selective Purges", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["pearl-sieve"];
  target.block = 9;
  target.combat.armor = 4;
  target.combat.thorns = 3;
  expect(removeEffects(target, "purge", 1, events, state, undefined, source)).toBe(2);
  expect(target.block).toBe(0);
  expect(target.combat.armor).toBe(0);
  expect(target.combat.thorns).toBe(3);
  source.block = 9;
  source.combat!.armor = 4;
  removeEffects(source, "purge", 1, events, state, undefined, target);
  expect(source.combat!.armor).toBe(4);
  target.block = 9;
  removeEffects(target, "purge", 1, events, state, "thorns", source);
  expect(target.block).toBe(9);
  removeEffects(target, "purge", 0, events, state, undefined, source);
  expect(target.block).toBe(9);
});

it("Tide Anklet matches both directions without spending or compounding Block, including positional swaps", () => {
  const { state, source, events } = fixture();
  state.boons = ["tide-anklet"];
  const backup = {
    id: "backup",
    species: "coralcurl" as const,
    health: species("coralcurl").health,
    block: 11,
    attacked: false,
    combat: freshCombat(),
  };
  addBackups(state, backup);
  source.block = 3;
  swapBackup(state, source.id, backup.id, events, true);
  expect([source.block, backup.block]).toEqual([11, 11]);
  swapBackup(state, backup.id, source.id, events, true);
  expect([source.block, backup.block]).toEqual([11, 11]);
  state.reserves = [];
  const other = state.team[0]!;
  other.block = 17;
  observeDecisions(state, (decision) => (decision?.kind === "index" ? 0 : 0.99));
  swapFromCard(state, source, events);
  expect(source.block).toBe(17);
  expect(other.block).toBe(17);
  expect(events.filter((event) => event.kind === "block")).toHaveLength(2);
});

it("Tide Anklet ignores knockout replacements and preparation outside battle", () => {
  const { state, source, events } = fixture();
  state.boons = ["tide-anklet"];
  const other = state.team[0]!;
  source.block = 20;
  source.health = 0;
  matchSwapBlock(state, source, other, events);
  expect(other.block).toBe(0);
  source.health = 1;
  matchSwapBlock({ ...state, phase: "campfire", battle: null, reward: null }, source, other, events);
  expect(other.block).toBe(0);
});

it("Obsidian Pitcher uses adjusted Leech overflow while preserving Last Threshold recovery", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["obsidian-pitcher", "last-threshold"];
  state.talents = ["health.mending"];
  source.health -= 2;
  const ally = state.team[0]!;
  ally.health = 1;
  ally.combat = { ...freshCombat(), deathDoorUsed: true, grace: 2 };
  // Ten Leech healing becomes eleven, restores two and leaves nine overflow.
  resolveCombat("leechHealth", state, source, 20, events, false, target);
  expect(source.health).toBe(species(source.species).health);
  expect(ally.health).toBe(10);
  expect(target.combat.burn).toBe(5);
  expect(target.combat.statusSources.burn).toBe(source.id);
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(0);
});

it("Obsidian Pitcher respects Nullify and reflection without feeding its own Leech", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["obsidian-pitcher"];
  target.combat.nullify = true;
  resolveCombat("leechHealth", state, source, 12, events, false, target);
  expect(target.combat).toMatchObject({ burn: 0, nullify: false });
  target.combat.reflect = true;
  resolveCombat("leechHealth", state, source, 12, events, false, target);
  expect(target.combat).toMatchObject({ burn: 0, reflect: false });
  expect(state.team.map((ally) => ally.combat!.burn)).toEqual([0, 0, 3]);
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(2);
});

it("Obsidian Pitcher retains the wounded enemy through deferred Bleed Leech", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["obsidian-pitcher"];
  hit(state, source, target, 10, "bleed", events, { origin: "proc", leech: true });
  expect(target.combat.burn).toBe(0);
  tickStatuses(state, target, events);
  expect(target.health).toBe(80);
  expect(target.combat).toMatchObject({ bleed: 0, bleedLeech: [], burn: 3 });
  expect(target.combat.statusSources.burn).toBe(source.id);
});

it("Obsidian Pitcher adds nothing without overflow or a surviving enemy", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["obsidian-pitcher"];
  source.health = 1;
  resolveCombat("leechHealth", state, source, 10, events, false, target);
  expect(target.combat.burn).toBe(0);
  source.health = species(source.species).health;
  target.health = 0;
  resolveCombat("leechHealth", state, source, 10, events, false, target);
  expect(target.combat.burn).toBe(0);
});

it("Molten Paperweight skips protected Burn without spending Cleanse or suppressing decay", () => {
  const { state, target, events } = fixture();
  state.boons = ["molten-paperweight"];
  target.block = 10;
  Object.assign(target.combat, { burn: 6, poison: 4 });
  expect(removeEffects(target, "cleanse", 1, events, state)).toBe(1);
  expect(target.combat).toMatchObject({ burn: 6, poison: 0 });
  expect(removeEffects(target, "cleanse", 1, events, state, "burn")).toBe(0);
  tickStatuses(state, target, events);
  expect(target.block).toBe(4);
  expect(target.combat.burn).toBe(3);
  target.block = 0;
  expect(removeEffects(target, "cleanse", 1, events, state)).toBe(1);
  expect(target.combat.burn).toBe(0);
});

it("Coronation Cloche preserves Nullify and every allied effect until a harmful application spends it", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["coronation-cloche", "comet-crucible", "basalt-glass-bookmark"];
  source.block = 5;
  Object.assign(source.combat!, { armor: 7, thorns: 4, nullify: true });
  const before = structuredClone(source);
  expect(removeEffects(source, "purge", 20, events, state, undefined, target)).toBe(0);
  expect(source).toEqual(before);
  expect(removeEffects(source, "purge", 1, events, state, "thorns", target)).toBe(0);
  applyBlind(state, target, source, events);
  expect(source.combat!.nullify).toBe(false);
  expect(source.combat!.blind).toBe(false);
  removeEffects(source, "purge", 1, events, state, undefined, target);
  expect(source.block).toBe(0);
  target.block = 5;
  target.combat.nullify = true;
  removeEffects(target, "purge", 1, events, state, undefined, source);
  expect(target.block).toBe(0);
});

it.each(["stun", "freeze"] as const)(
  "Vigil Lantern preserves %s duration, immunity and Dodge rules while admitting actions",
  (status) => {
    const { state, source, events } = fixture();
    source.health = 1;
    source.combat = { ...freshCombat(), controlled: status, controlTurns: 2, deathDoorUsed: true, grace: 2 };
    expect(controlled(source, state)).toBe(true);
    state.boons = ["vigil-lantern"];
    expect(startAction(source, events, state)).toBe(true);
    expect(source.combat).toMatchObject({ controlled: status, controlTurns: 1, skipped: true, grace: 2 });
    expect(ownDodgeChance(state, source)).toBe(0);
    expect(startAction(source, events, state)).toBe(true);
    expect(source.combat).toMatchObject({ controlled: null, controlTurns: 0, cooldown: 3 });
    source.combat.grace = 0;
    expect(controlled(source, state)).toBe(true);
  },
);

it("Vigil Lantern shares command admission with previews and survives resume without extra Mana or plays", () => {
  const state = requireBattle(structuredClone(run()));
  const source = state.team[1]!;
  source.health = 1;
  source.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 2, deathDoorUsed: true, grace: 2 };
  const card = state.cards.find((entry) => entry.definitionId === "emberback-attack")!;
  setBattleCards(state, [card.id]);
  expect(inspectCardPlay(state, card.id).allowed).toBe(false);
  state.boons = ["vigil-lantern"];
  const resumed = requireBattle(decodeSave(encodeSave(state)));
  expect(inspectCardPlay(resumed, card.id).allowed).toBe(true);
  const before = encodeSave(resumed);
  const preview = previewCard(resumed, card.id, resumed.battle.enemies[0]!.id);
  const result = dispatch(resumed, {
    type: "play",
    cardId: card.id,
    targetId: resumed.battle.enemies[0]!.id,
    autoEndTurn: false,
  });
  expect(result.accepted).toBe(true);
  expect(result.state).toEqual(preview.state);
  expect(encodeSave(resumed)).toBe(before);
  expect(result.state.battle!.mana).toBe(resumed.battle.mana - 1);
  expect(result.state.battle!.cardsPlayedThisTurn).toBe(1);
});

it("Vigil Lantern stops automatic skipped-turn advancement when the surviving ally can act", () => {
  const { state, source } = fixture();
  state.boons = ["vigil-lantern"];
  for (const unit of state.team) unit.health = 0;
  source.health = 1;
  source.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 3, deathDoorUsed: true, grace: 2 };
  for (const enemy of state.battle.enemies)
    Object.assign(enemy.combat, { controlled: "freeze", controlTurns: 4 });
  const next = accept(state, { type: "endTurn" });
  expect(next.battle!.turn).toBe(state.battle.turn + 1);
  expect(next.team[1]!.combat).toMatchObject({ grace: 1, controlled: "freeze", controlTurns: 2 });
});

it("Grain Flail breaks Armor after the breaking hit and preserves its one Armor-break reaction", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["grain-flail"];
  target.block = 6;
  target.combat.armor = 8;
  hit(state, source, target, 6, "physical", events, { origin: "proc" });
  expect(target.health).toBe(100);
  expect(target.combat.armor).toBe(0);
  expect(events.filter((event) => event.kind === "damage" && event.actorId === target.id)).toHaveLength(3);
  hit(state, source, target, 4, "physical", events, { origin: "proc" });
  expect(target.health).toBe(96);
  expect(
    events.filter(
      (event) => event.kind === "status" && event.status === "armor" && event.targetId === target.id,
    ),
  ).toHaveLength(1);
});

it("Grain Flail applies to a Dodged shield break through Coral Net Weight", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["grain-flail", "coral-net-weight"];
  target.block = 4;
  target.combat.armor = 9;
  hit(state, source, target, 4, "water", events, { origin: "ability", blindMiss: true });
  expect(target.block).toBe(0);
  expect(target.combat.armor).toBe(0);
  expect(target.health).toBe(100);
});

it("Gemmed Scabbard mitigates each Thorns pool with current Armor and retains Fire Thorns buildup", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["gemmed-scabbard"];
  // Mossguard has no Armor-break attack to obscure retaliation totals.
  const attacker = state.team[0]!;
  attacker.combat!.armor = 3;
  Object.assign(target.combat, { thorns: 4, waterThorns: 4, fireThorns: 4 });
  const health = attacker.health;
  hit(state, attacker, target, 1, "physical", events, { origin: "ability", blindMiss: false });
  expect(attacker.health).toBe(health - 6);
  expect(attacker.combat).toMatchObject({ armor: 0, burn: 3 });
  expect(target.combat).toMatchObject({ thorns: 3, waterThorns: 3, fireThorns: 3 });
  expect(source.health).toBe(species(source.species).health);
});

it("Gemmed Scabbard does not grant Armor protection against unrelated retaliation or ordinary Water damage", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["gemmed-scabbard"];
  source.combat!.armor = 8;
  const before = source.health;
  hit(state, target, source, 3, "water", events, { origin: "retaliation" });
  hit(state, target, source, 3, "nature", events, { origin: "statusRetaliation" });
  expect(source.health).toBe(before - 6);
  expect(source.combat!.armor).toBe(8);
});

it("Dream Tangram moves only the existing repeat and sends its harmful extras to the new enemy", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["dream-tangram"];
  state.battle.repeatNext.player = true;
  target.health = 1;
  const next = state.battle.enemies[1]!;
  next.health = next.maxHealth = 100;
  const def = { ...definition("emberback-attack"), effects: [{ kind: "purge" as const, amount: 1 }] };
  next.block = 2;
  next.combat.armor = 4;
  executeAbility(state, { side: "player", actor: source, def, value: 4, targetId: target.id }, events, {
    swap: swapFromCard,
  });
  expect(target.health).toBe(0);
  expect(next.block).toBe(0);
  expect(next.combat.armor).toBe(0);
  expect(
    events
      .filter(
        (event): event is Extract<GameEvent, { kind: "damage" }> =>
          event.kind === "damage" && event.actorId === source.id,
      )
      .map((event) => event.targetId),
  ).toEqual([target.id, next.id]);
  expect(state.battle.repeatNext.player).toBe(false);
  expect(source.combat!.cardsPlayedThisTurn).toBe(1);
});

it("Dream Tangram does not invent a repeat or retarget a living original target", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["dream-tangram"];
  target.health = 1;
  const def = definition("emberback-attack");
  executeAbility(state, { side: "player", actor: source, def, value: 4, targetId: target.id }, events, {
    swap: swapFromCard,
  });
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(1);
  target.health = 100;
  state.battle.repeatNext.player = true;
  events.length = 0;
  executeAbility(state, { side: "player", actor: source, def, value: 4, targetId: target.id }, events, {
    swap: swapFromCard,
  });
  expect(events.filter((event) => event.kind === "damage").map((event) => event.targetId)).toEqual([
    target.id,
    target.id,
  ]);
});

it("Comet Crucible grants Block after the whole Purge and retains ordinary Armor-break and Block rewards", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["comet-crucible", "ironwood-buckler"];
  source.block = 5;
  Object.assign(source.combat!, { armor: 6, thorns: 4 });
  expect(removeEffects(source, "purge", 3, events, state, undefined, target)).toBe(3);
  expect(source.block).toBe(6);
  expect(source.combat).toMatchObject({ armor: 0, thorns: 1 });
  expect(events.filter((event) => event.kind === "damage" && event.actorId === source.id)).toHaveLength(3);
  removeEffects(source, "purge", 1, events, state, undefined, target);
  expect(source.block).toBe(0);
  target.combat.armor = 6;
  removeEffects(target, "purge", 1, events, state, undefined, source);
  expect(target.block).toBe(0);
});

it("all ten approved rules retain current-format ownership through reload without pending work", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = BOONS.filter((boon) => Object.hasOwn(NEW_BOON_EFFECTS, boon.id)).map((boon) => boon.id);
  const next = decodeSave(encodeSave(state));
  expect(next).toEqual(state);
  const before = encodeSave(next);
  expect(dispatch(next, { type: "play", cardId: "missing" }).state).toBe(next);
  expect(encodeSave(next)).toBe(before);
});

it.each([false, true])(
  "Dream Tangram %s continues a successful Resonance without another repeat roll",
  (owned) => {
    const { state, source, target, events } = fixture();
    source.species = "ringpalm";
    state.boons = owned ? ["dream-tangram"] : [];
    target.health = 1;
    const next = state.battle.enemies[1]!;
    next.block = 0;
    const before = next.health;
    let rolls = 0;
    observeDecisions(state, () => {
      rolls++;
      return 0.01;
    });
    hit(state, source, target, 4, "stun", events, { origin: "proc" });
    expect(next.health).toBe(before - (owned ? 4 : 0));
    expect(rolls).toBe(owned ? 1 : 0);
    expect(events.filter((event) => event.kind === "damage")).toHaveLength(owned ? 2 : 1);
  },
);
