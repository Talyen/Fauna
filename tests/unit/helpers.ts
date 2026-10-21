import { freshCombat } from "../../src/game/combat";
import { controlled } from "../../src/game/combat";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { CARDS, definition, species, type SpeciesId } from "../../src/game/content";
import type { Command, GameState } from "../../src/game/types";
export function run(seed = 42) {
  return teamRun(seed, ["mossback", "emberfox", "stormfin"]);
}
/** A progressed lineup fixture for multi-creature combat coverage. */
export function teamRun(seed: number, kinds: SpeciesId[]) {
  let s = createGame(seed);
  s = produce(s, (d) => {
    if (kinds.includes("moonhart")) {
      d.unlocked.push("moonhart");
      d.wins = 1;
    }
    d.selected = [kinds[0]!];
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
  return accept(s, { type: "play", cardId: card, targetId: "enemy-0" });
}
export function policy(s: GameState): Command {
  if (s.phase === "teamSelection") return { type: "beginBattle" };
  if (s.phase === "recruit") return { type: "skipRecruit" };
  if (s.phase === "boon") return { type: "chooseBoon", boon: s.reward!.boons[0]! };
  if (s.phase === "campfire") return { type: "rest" };
  const b = s.battle!;
  const enemy = b.enemies.filter((e) => e.health > 0).sort((a, b) => a.health - b.health)[0]!;
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
  if (attack) return { type: "play", cardId: attack.id, targetId: enemy.id };
  const heal = cards.find((c) => definition(c.definitionId).effect === "heal");
  const injured = s.team
    .filter((c) => c.health > 0 && c.health < species(c.species).health)
    .sort((a, b) => a.health - b.health)[0];
  if (heal && injured) return { type: "play", cardId: heal.id, targetId: injured.id };
  const teamGuard = cards.find((c) => definition(c.definitionId).effect === "teamGuard");
  if (teamGuard) return { type: "play", cardId: teamGuard.id };
  const guard = cards.find((c) => definition(c.definitionId).effect === "guard");
  if (guard) {
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
