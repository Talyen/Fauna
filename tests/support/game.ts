import { canVisitCampfire } from "../../src/game/destinations";
import { ownedCards, swapBackup } from "../../src/game/team";
import { freshCombat, ensureCombat } from "../../src/game/combat/index";
import { controlled } from "../../src/game/combat/index";
import { produce } from "immer";
import { encounterPacks } from "../../src/game/encounters";
import { createGame, dispatch } from "../../src/game/engine";
import { definition, species, type SpeciesId } from "../../src/game/content";
import type { Command, GameState, Lifecycle, BattleState, Creature } from "../../src/game/types";
// Shared bound accounts for solo Legendary Bosses and their recruitment choices
// Fixed current-catalog full-journey fixture; shared with the browser expedition.
export const FULL_JOURNEY_SEED = 13;
export const FULL_JOURNEY_COMMAND_BUDGET = 800;
export function run(seed = 42) {
  return teamRun(seed, ["mossguard", "emberback", "prismram"]);
}
/** Fix the offered starter for scenarios whose behavior depends on that creature's kit. */
export function starterJourney(seed: number, kind: SpeciesId) {
  const initial = produce(createGame(seed), (draft) => {
    draft.starterOffers = [kind, ...draft.starterOffers.filter((offer) => offer !== kind)].slice(0, 3);
  });
  return accept(accept(initial, { type: "draft", species: kind }), { type: "start" });
}
/** A progressed lineup fixture for multi-creature combat coverage. */
export function teamRun(seed: number, kinds: SpeciesId[]) {
  let s = createGame(seed);
  s = produce(s, (d) => {
    d.selected = [kinds[0]!];
    d.starterOffers = [];
    d.discovery = {
      encountered: [...new Set(kinds)],
      recruited: Object.fromEntries(kinds.map((kind) => [kind, 1])),
    };

    d.team = kinds.map((kind, i) => ({
      id: `ally-${i}`,
      species: kind,
      health: species(kind).health,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));

    d.cards = d.team.flatMap((c) => ownedCards(c.id, c.species));
    prepareDestination(d);
    d.encounter = 2;
    d.journey!.victories = 2;
    d.expedition = { pack: ["emberback", "pollenmoth", "mossguard"], recruit: null, lastRoom: null };
  });
  return accept(s, { type: "beginBattle" });
}
export function accept(s: GameState, c: Command) {
  const result = dispatch(s, c);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
/** Backups in valid checkpoints already have committed Collection records. */
export function addBackups(state: GameState, ...creatures: Creature[]) {
  for (const creature of creatures) {
    if (!state.discovery.encountered.includes(creature.species))
      state.discovery.encountered.push(creature.species);
    state.discovery.recruited[creature.species] ??= 1;
  }
  state.reserves.push(...creatures);
}
/** Set up formation/lifetime scenarios without admitting a free player command. */
export function swapFixture(s: GameState, command: Extract<Command, { type: "swap" }>) {
  return produce(s, (draft) => swapBackup(draft, command.activeId, command.reserve, []));
}
export function victoryReady(s = run()) {
  return produce(s, (d) => {
    d.battle!.enemies.forEach((e, i) => {
      e.health = i === 0 ? 1 : 0;
      e.block = 0;
      e.combat.armor = 0;
      e.combat.controlled = i === 0 ? "stun" : null;
      e.combat.controlTurns = i === 0 ? 1 : 0;
      e.combat.cooldown = 0;
      e.combat.skipped = false;
    });
    const attack = d.cards.find((c) => definition(c.definitionId).effect === "attack")!;
    ensureCombat(d.team.find((creature) => creature.id === attack.ownerId)!).blind = false;
    d.battle!.hand = [attack.id];
    d.battle!.buffer = [];
    d.battle!.draw = d.cards.filter((c) => c.id !== attack.id).map((c) => c.id);
    d.battle!.discard = [];
    d.battle!.mana = 3;
  });
}
export function winBattle(s = run()) {
  s = victoryReady(s);
  const card = s.battle!.hand[0]!;
  return accept(s, {
    type: "play",
    cardId: card,
    targetId: s.battle!.enemies.find((enemy) => enemy.health > 0)!.id,
  });
}
/** A full roster at the recruitment boundary, including distinct backup individuals. */
export function fullRosterReward(state = winBattle()) {
  if (state.phase !== "recruit") throw new Error("Expected a Recruit reward");
  return produce(state, (draft) => {
    const kinds = ["pollenmoth", "prismram"] as const;
    for (let index = 0; draft.team.length + draft.reserves.length < 5; index++) {
      const kind = kinds[index % kinds.length]!;
      draft.reserves.push({
        id: `reward-reserve-${index}`,
        species: kind,
        health: species(kind).health,
        block: 0,
        attacked: false,
      });
      if (!draft.discovery.encountered.includes(kind)) draft.discovery.encountered.push(kind);
      draft.discovery.recruited[kind] ??= 1;
    }
  });
}
export function recruitChoice(s: GameState): Command {
  if (s.phase !== "recruit") throw new Error("Expected recruitment choice");
  return s.reward.selectedRecruit !== undefined
    ? { type: "confirmRecruit", replace: [...s.team, ...s.reserves].at(-1)!.id }
    : { type: "recruit", species: s.reward.recruits[0]! };
}
/** Finish the two-command recruitment boundary for fixtures that need the next room. */
export function completeRecruitment(state: GameState) {
  const recruited = accept(state, recruitChoice(state));
  return recruited.phase === "recruit" ? accept(recruited, recruitChoice(recruited)) : recruited;
}
export function policy(s: GameState): Command {
  if (s.phase === "teamSelection")
    return canVisitCampfire(s) ? { type: "visitCampfire" } : { type: "beginBattle" };
  if (s.phase === "recruit") return recruitChoice(s);
  if (s.phase === "boon") return { type: "chooseBoon", boon: s.reward!.boons[0]! };
  if (s.phase === "campfire") return { type: "rest" };
  const b = s.battle!;
  const fallen = s.team.find((c) => c.health <= 0);
  const backup = s.reserves.find((c) => c.health > 0);
  if (fallen && backup) return { type: "swap", activeId: fallen.id, reserve: backup.id };
  // A Physical/Stun-only lineup must focus Armor builders before they outgrow its damage
  const armorBound = s.cards.every((card) => {
    const def = definition(card.definitionId);
    return def.effect !== "attack" || ["physical", "stun"].includes(def.damageType);
  });
  const enemy = b.enemies
    .filter((e) => e.health > 0)
    .sort(
      (a, b) =>
        Number(armorBound) * (Number(b.species === "emberback") - Number(a.species === "emberback")) ||
        a.health - b.health,
    )[0]!;
  const cards = b.hand
    .map((id) => s.cards.find((c) => c.id === id)!)
    .filter(
      (c) =>
        definition(c.definitionId).cost <= b.mana &&
        s.team.some((unit) => unit.id === c.ownerId && unit.health > 0 && !controlled(unit)),
    );
  const attacks = cards.filter((c) => definition(c.definitionId).effect === "attack");
  const attack = attacks.sort(
    (a, b) =>
      definition(b.definitionId).value + b.level * 2 - (definition(a.definitionId).value + a.level * 2),
  )[0];
  if (attack) {
    const def = definition(attack.definitionId);
    return {
      type: "play",
      cardId: attack.id,
      ...(def.effect === "attack" && !def.target ? { targetId: enemy.id } : {}),
    };
  }
  const draw = cards.find((card) => {
    const def = definition(card.definitionId);
    return def.effect === "draw" || def.effects?.some((effect) => effect.kind === "draw");
  });
  if (draw) return { type: "play", cardId: draw.id };
  const heal = cards.find((c) => definition(c.definitionId).effect === "heal");
  const injured = s.team
    .filter((c) => c.health > 0 && c.health < species(c.species).health)
    .sort((a, b) => a.health - b.health)[0];
  if (heal && injured) {
    const def = definition(heal.definitionId);
    return {
      type: "play",
      cardId: heal.id,
      ...(def.effect === "heal" && !def.target ? { targetId: injured.id } : {}),
    };
  }
  const groupProtection = cards.find((c) => {
    const def = definition(c.definitionId);
    return (
      (def.effect === "guard" && def.target === "allAllies") ||
      ["teamProtection", "nullify"].includes(def.effect)
    );
  });
  if (groupProtection) return { type: "play", cardId: groupProtection.id };
  const guard = cards.find((c) => definition(c.definitionId).effect === "guard");
  if (guard) {
    const def = definition(guard.definitionId);
    if (def.effect === "guard" && def.target === "self") return { type: "play", cardId: guard.id };
    const target = s.team
      .filter((c) => c.health > 0)
      .sort(
        (left, right) =>
          b.enemies.filter((e) => e.health > 0 && e.targetId === right.id).length -
          b.enemies.filter((e) => e.health > 0 && e.targetId === left.id).length,
      )[0]!;
    return { type: "play", cardId: guard.id, targetId: target.id };
  }
  return { type: "endTurn" };
}

/** A saved intermediate boss with its actual authored pack and a progressed three-creature team. */
export function bossReward() {
  const ready = produce(run(), (d) => {
    prepareDestination(d);
    d.encounter = 3;
    d.journey!.victories = d.encounter;
    d.journey!.victories = 3;
    d.expedition = { pack: authoredPack(d.encounter), recruit: null, lastRoom: null };
  });
  const recruit = winBattle(accept(ready, { type: "beginBattle" }));
  return accept(recruit, recruitChoice(recruit));
}

export function feedbackBattle() {
  const battle = accept(
    produce(teamRun(42, ["mossguard", "emberback", "prismram"]), (game) => {
      prepareDestination(game);
      game.encounter = 2;
      game.journey!.victories = game.encounter;
      game.journey!.victories = 2;
      game.battle = null;
      game.expedition = { pack: ["prismram", "pollenmoth", "mossguard"], recruit: null, lastRoom: null };
    }),
    { type: "beginBattle" },
  );
  return produce(battle, (game) => {
    game.rng = 1;
    const attack = game.cards.find((card) => card.definitionId === "emberback-attack")!;
    game.battle!.hand = [attack.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.id !== attack.id).map((card) => card.id);
    const actor = game.team.find((creature) => creature.id === attack.ownerId)!;
    actor.health -= 5;
    ensureCombat(actor).riposte = true;
    ensureCombat(actor).partingCut = true;
    const target = game.battle!.enemies[0]!;
    target.block = 4;
    target.combat.armor = 0;
    target.combat.thorns = 1;
  });
}

/** Re-enter a destination for an isolated scenario, discarding the previous battle's lifetime. */
export function prepareDestination(state: GameState) {
  const next = {
    phase: "teamSelection",
    battle: null,
    reward: null,
    support: null,
    expedition: state.expedition,
    journey: {
      currency: state.journey?.currency ?? 0,
      xp: state.journey?.xp ?? {},
      outcome: null,
      victories: state.encounter,
      lastBattle: null,
    },
  } satisfies Lifecycle;
  return Object.assign(state, next);
}

export function requireBattle(state: GameState): BattleState {
  if (state.phase !== "battle") throw new Error("Scenario requires active combat.");
  return state;
}

/** A saved Merchant destination funded for any baseline offer; journey earnings stay exact. */
export function merchantDestination() {
  // Starter identity affects roster exclusions and the number of destination RNG draws.
  let state = starterJourney(3, "captoad");
  state = winBattle(accept(state, { type: "beginBattle" }));
  // Fix this scenario's destination roll independently of the changing recruit catalog.
  state = produce(state, (draft) => {
    draft.rng = 10;
    draft.currency = 40;
  });
  const ready = accept(state, recruitChoice(state));
  if (ready.phase !== "teamSelection" || !ready.support) throw new Error("Expected seeded Merchant stock.");
  return ready;
}

/** Choose an authored battle explicitly for kit and boundary fixtures. */
export function authoredPack(encounter: number, index = 0): SpeciesId[] {
  return encounterPacks(encounter)[index]!.slice(0, Math.min(3, encounter + 1));
}
