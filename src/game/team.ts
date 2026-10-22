import { recycleDiscard, fillHand, MAX_BATTLE_CARDS } from "./card-zones";
import { removeDepartedMinions } from "./combat/legendary";
import { shuffle, roll } from "./random";
import { CARDS, species } from "./content";
import type { Card, GameEvent, GameState } from "./types";

export function living(state: GameState) {
  return state.team.filter((c) => c.health > 0);
}
export function ownedCards(id: string, kind: GameState["team"][number]["species"]): Card[] {
  return CARDS.filter((c) => c.species === kind).flatMap((c) =>
    Array.from({ length: species(kind).legendary ? 2 : 1 }, (_, index) => ({
      id: `${id}:${c.id}${index ? ":2" : ""}`,
      definitionId: c.id,
      ownerId: id,
      level: 0,
    })),
  );
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
export function formationForSwap(
  all: import("./types").Creature[],
  active: string[],
  outgoing: string,
  incoming: string,
) {
  const next = all.find((unit) => unit.id === incoming)!;
  if (species(next.species).legendary) return [next.id];
  const index = active.indexOf(outgoing);
  const ids = active.filter((id) => !species(all.find((unit) => unit.id === id)!.species).legendary);
  if (index < 0 || ids.length !== active.length) ids.push(incoming);
  else ids[index] = incoming;
  return ids;
}
export function setFormation(state: GameState, ids: string[], events: GameEvent[] = [], fromCard = false) {
  const all = [...state.team, ...state.reserves];
  const previous = state.cards;
  const departing = new Set(state.team.filter((unit) => !ids.includes(unit.id)).map((unit) => unit.id));
  state.team = ids.map((id) => all.find((unit) => unit.id === id)!);
  state.reserves = all.filter((unit) => !ids.includes(unit.id));
  const retained = previous.filter((card) => ids.includes(card.ownerId));
  const slots = previous.filter((card) => departing.has(card.ownerId) && !card.temporary);
  const needed = state.team
    .filter((unit) => !previous.some((card) => card.ownerId === unit.id))
    .flatMap((unit) => ownedCards(unit.id, unit.species));
  const used = new Set(retained.map((card) => card.id));
  const mapped = needed.map((card, index) => {
    let id = slots[index]?.id ?? card.id;
    for (let serial = 0; used.has(id); serial++) id = `slot-${state.revision}-${index}-${serial}`;
    used.add(id);
    return { ...card, id };
  });
  // New permanent kits take priority over the newest generated copies at the battle limit.
  const overflow = Math.max(0, retained.length + mapped.length - MAX_BATTLE_CARDS);
  const removed = new Set(
    overflow
      ? retained
          .filter((card) => card.temporary)
          .slice(-overflow)
          .map((card) => card.id)
      : [],
  );
  state.cards = [...retained.filter((card) => !removed.has(card.id)), ...mapped];
  if (state.battle) {
    const kept = new Set(state.cards.map((card) => card.id));
    const changed = new Set(mapped.map((card) => card.id));
    for (const zone of ["draw", "hand", "buffer", "discard"] as const)
      state.battle[zone] = state.battle[zone].filter((id) => kept.has(id) && (!fromCard || !changed.has(id)));
    const zoned = new Set([
      ...state.battle.draw,
      ...state.battle.hand,
      ...state.battle.buffer,
      ...state.battle.discard,
    ]);
    const added = mapped.filter((card) => !zoned.has(card.id)).map((card) => card.id);
    if (added.length) state.battle.draw = shuffle(state, [...state.battle.draw, ...added]);
    for (const enemy of state.battle.enemies) if (departing.has(enemy.targetId)) enemy.targetId = ids[0]!;
    removeDepartedMinions(state);
    fillHand(state);
    recycleDiscard(state);
  }
  events.push({ kind: "action", actionType: "swap", actorId: ids[0], text: "Your formation changes" });
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
  const outgoing = state.team[index];
  const incoming = state.reserves[backupIndex]!;
  if (!outgoing || species(incoming.species).legendary || species(outgoing.species).legendary) {
    setFormation(
      state,
      formationForSwap(
        [...state.team, ...state.reserves],
        state.team.map((unit) => unit.id),
        activeId,
        backupId,
      ),
      events,
      fromCard,
    );
    if (state.phase !== "battle") state.lineup = state.team.map((unit) => unit.id);
    return;
  }
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
  if (state.battle) recycleDiscard(state);
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
