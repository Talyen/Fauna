import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { definition, species } from "../../src/game/content";
import type { Command, GameState } from "../../src/game/types";
export function run(seed = 42) {
  let s = createGame(seed);
  for (const kind of ["mossback", "emberfox", "stormfin"] as const)
    s = accept(s, { type: "draft", species: kind });
  return accept(s, { type: "start" });
}
export function accept(s: GameState, c: Command) {
  const result = dispatch(s, c);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
export function victoryReady(s = run()) {
  return produce(s, (d) => {
    d.battle!.enemies.forEach((e, i) => (e.health = i === 0 ? 1 : 0));
    const attack = d.cards.find((c) => definition(c.definitionId).effect === "attack")!;
    d.battle!.hand = [attack.id];
    d.battle!.draw = d.cards.filter((c) => c.id !== attack.id).map((c) => c.id);
    d.battle!.discard = [];
    d.battle!.energy = 3;
  });
}
export function winBattle(s = run()) {
  s = victoryReady(s);
  const card = s.battle!.hand[0]!;
  return accept(s, { type: "play", cardId: card, targetId: "enemy-0" });
}
export function policy(s: GameState): Command {
  if (s.phase === "reward") {
    const card = s.cards
      .filter((c) => c.level < 3)
      .sort(
        (a, b) =>
          Number(definition(b.definitionId).effect === "attack") -
          Number(definition(a.definitionId).effect === "attack"),
      )[0]!;
    return { type: "upgrade", cardId: card.id };
  }
  const b = s.battle!;
  const enemy = b.enemies.filter((e) => e.health > 0).sort((a, b) => a.health - b.health)[0]!;
  const cards = b.hand
    .map((id) => s.cards.find((c) => c.id === id)!)
    .filter((c) => definition(c.definitionId).cost <= b.energy);
  const attacks = cards.filter((c) => definition(c.definitionId).effect === "attack");
  const mark = cards.find((c) => definition(c.definitionId).effect === "mark");
  if (mark && attacks.length && b.energy >= 2 && enemy.health > 15 && enemy.marks === 0)
    return { type: "play", cardId: mark.id, targetId: enemy.id };
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
  if (mark) return { type: "play", cardId: mark.id, targetId: enemy.id };
  return { type: "endTurn" };
}
