import { freshCombat, combat } from "../../src/game/combat";
import { controlled } from "../../src/game/combat";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { CARDS, definition, species, type SpeciesId } from "../../src/game/content";
import type { Command, GameState } from "../../src/game/types";
// This seeded first journey finishes within the browser's 400-command budget
export const FULL_JOURNEY_SEED = 1648773224;
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
    d.roster = [...kinds];
    d.team = kinds.map((kind, i) => ({
      id: `ally-${i}`,
      species: kind,
      health: species(kind).health,
      block: 0,
      combat: freshCombat(),
      attacked: false,
    }));
    d.lineup = d.team.map((c) => c.id);
    d.cards = d.team.flatMap((c) =>
      CARDS.filter((card) => card.species === c.species).map((card) => ({
        id: `${c.id}:${card.id}`,
        definitionId: card.id,
        ownerId: c.id,
        level: 0,
      })),
    );
    d.phase = "teamSelection";
    d.expedition = null;
  });
  return accept(s, { type: "beginBattle" });
}
export function accept(s: GameState, c: Command) {
  const result = dispatch(s, c);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
export function victoryReady(s = run()) {
  return produce(s, (d) => {
    d.battle!.enemies.forEach((e, i) => {
      e.health = i === 0 ? 1 : 0;
      e.block = 0;
      e.combat.armor = 0;
      e.combat.controlled = i === 0 ? "stun" : null;
      e.combat.cooldown = 0;
      e.combat.skipped = false;
    });
    const attack = d.cards.find((c) => definition(c.definitionId).effect === "attack")!;
    combat(d.team.find((creature) => creature.id === attack.ownerId)!).blind = false;
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
export function recruitChoice(s: GameState): Command {
  return {
    type: "recruit",
    species: s.reward!.recruits[0]!,
    ...(s.roster.length === 5 ? { replace: [...s.team, ...s.reserves].at(-1)!.id } : {}),
  };
}
export function policy(s: GameState): Command {
  if (s.phase === "teamSelection") return { type: "beginBattle" };
  if (s.phase === "recruit") return recruitChoice(s);
  if (s.phase === "boon") return { type: "chooseBoon", boon: s.reward!.boons[0]! };
  if (s.phase === "campfire") return { type: "rest" };
  const b = s.battle!;
  const fallen = s.team.find((c) => c.health <= 0);
  const backup = s.reserves.find((c) => c.health > 0 && !controlled(c));
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
  const teamGuard = cards.find((c) =>
    ["teamGuard", "teamProtection", "nullify"].includes(definition(c.definitionId).effect),
  );
  if (teamGuard) return { type: "play", cardId: teamGuard.id };
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
    d.phase = "teamSelection";
    d.battle = null;
    d.encounter = 3;
    d.expedition = { pack: 0 };
  });
  return winBattle(accept(ready, { type: "beginBattle" }));
}

export function feedbackBattle() {
  const battle = accept(
    produce(teamRun(42, ["mossguard", "emberback", "prismram"]), (game) => {
      game.phase = "teamSelection";
      game.encounter = 1;
      game.battle = null;
      game.expedition = null;
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
    combat(actor).riposte = true;
    combat(actor).partingCut = true;
    const target = game.battle!.enemies[0]!;
    target.block = 4;
    target.combat.armor = 0;
    target.combat.thorns = 1;
  });
}
