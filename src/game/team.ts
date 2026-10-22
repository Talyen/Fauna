import { shuffle, roll } from "./random";
import { CARDS, species } from "./content";
import type { Card, GameEvent, GameState } from "./types";

export function living(state: GameState) {
  return state.team.filter((c) => c.health > 0);
}
export function ownedCards(id: string, kind: GameState["team"][number]["species"]): Card[] {
  return CARDS.filter((c) => c.species === kind).map((c) => ({
    id: `${id}:${c.id}`,
    definitionId: c.id,
    ownerId: id,
    level: 0,
  }));
}
export function prepareLineup(state: GameState) {
  const all = [...state.team, ...state.reserves];
  state.team = state.lineup.map((id) => all.find((c) => c.id === id)!);
  state.reserves = all.filter((c) => !state.lineup.includes(c.id));
  rebuildCards(state);
}
export function rebuildCards(state: GameState) {
  const previous = state.cards;
  state.cards = state.team
    .flatMap((c) => ownedCards(c.id, c.species))
    .map(
      (card) =>
        previous.find(
          (old) =>
            old.id === card.id && old.ownerId === card.ownerId && old.definitionId === card.definitionId,
        ) ?? card,
    );
  if (state.battle) {
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.discard = [];
    state.battle.draw = state.cards.map((c) => c.id);
  }
}
/** Manual swaps retain zone slots; swap cards return the incoming kit to the draw pile. */
export function swapBackup(
  state: GameState,
  activeId: string,
  backupId: string,
  events: GameEvent[],
  fromCard = false,
) {
  const index = state.team.findIndex((unit) => unit.id === activeId);
  const backupIndex = state.reserves.findIndex((unit) => unit.id === backupId);
  const outgoing = state.team[index]!;
  const incoming = state.reserves[backupIndex]!;
  state.team[index] = incoming;
  state.reserves[backupIndex] = outgoing;
  const oldDefs = CARDS.filter((card) => card.species === outgoing.species);
  const newDefs = CARDS.filter((card) => card.species === incoming.species);
  const replaced = state.cards.filter((card) => card.ownerId === outgoing.id);
  for (const card of replaced) {
    card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
    card.ownerId = incoming.id;
    card.level = 0;
  }
  if (state.battle) {
    for (const enemy of state.battle.enemies)
      if (enemy.targetId === outgoing.id) enemy.targetId = incoming.id;
    if (fromCard) {
      const ids = new Set(replaced.map((card) => card.id));
      for (const zone of ["draw", "hand", "buffer", "discard"] as const)
        state.battle[zone] = state.battle[zone].filter((id) => !ids.has(id));
      state.battle.draw = shuffle(state, [...state.battle.draw, ...ids]);
    }
  }
  if (state.phase !== "battle") state.lineup = state.team.map((unit) => unit.id);
  events.push({
    kind: "action",
    actionType: "swap",
    actorId: incoming.id,
    text: `${species(incoming.species).name} replaces ${species(outgoing.species).name}.`,
  });
}
export function swapFromCard(
  state: GameState,
  actor: import("./combat/index").Combatant,
  events: GameEvent[],
) {
  const allied = !("maxHealth" in actor);
  const backup = allied ? state.reserves.filter((unit) => unit.health > 0) : [];
  if (backup.length) {
    const incoming = backup[Math.floor(roll(state) * backup.length)]!;
    swapBackup(state, actor.id, incoming.id, events, true);
    return;
  }
  const row = allied ? state.team : state.battle!.enemies;
  const others = row.filter((unit) => unit.id !== actor.id && unit.health > 0);
  if (!others.length) return;
  const other = others[Math.floor(roll(state) * others.length)]!;
  const from = row.findIndex((unit) => unit.id === actor.id);
  const to = row.findIndex((unit) => unit.id === other.id);
  [row[from], row[to]] = [row[to]!, row[from]!];
  events.push({
    kind: "action",
    actionType: "swap",
    actorId: actor.id,
    targetId: other.id,
    text: `${species(actor.species).name} swaps positions with ${species(other.species).name}.`,
  });
}
