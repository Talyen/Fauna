import { definition, species } from "./content";
import type { GameEvent, GameState } from "./types";
import { chance as succeeds } from "./chance";
import { shuffle } from "./random";
import { cardKeywords, creaturePassive } from "./progression";

export const MAX_HAND_SIZE = 6;
// Bound generated cards and their overflow within the supported save size.
export const MAX_BATTLE_CARDS = 256;

export function recycleDiscard(
  state: GameState,
  zones: { draw: string[]; discard: string[] } = state.battle!,
) {
  if (!zones.draw.length && zones.discard.length) zones.draw.push(...shuffle(state, zones.discard.splice(0)));
}
export function receiveCard(state: GameState, id: string) {
  fillHand(state);
  const battle = state.battle!;
  (battle.hand.length < MAX_HAND_SIZE ? battle.hand : battle.buffer).push(id);
}
function receiveDraw(state: GameState, id: string, events: GameEvent[]) {
  const battle = state.battle!;
  (battle.hand.length < MAX_HAND_SIZE ? battle.hand : battle.buffer).push(id);
  const original = state.cards.find((entry) => entry.id === id)!;
  // Copy insertion and buffer promotion are not draws and cannot recursively copy.
  for (const reader of state.team) {
    if (
      reader.health <= 0 ||
      state.cards.length >= MAX_BATTLE_CARDS ||
      battle.copySerial >= Number.MAX_SAFE_INTEGER
    )
      continue;
    const chance = creaturePassive(state, reader.species).effects.reduce(
      (amount, effect) => amount + (effect.kind === "wellRead" ? effect.amount : 0),
      0,
    );
    if (!succeeds(state, chance / 100, false, events)) continue;
    const copy = { ...original, id: `copy-${battle.copySerial++}`, temporary: true as const };
    state.cards.push(copy);
    (battle.hand.length < MAX_HAND_SIZE ? battle.hand : battle.buffer).push(copy.id);
    events.push({
      kind: "action",
      actionType: "support",
      actorId: reader.id,
      targetId: original.ownerId,
      text: `${species(reader.species).name} copies ${definition(original.definitionId).name} with Well Read`,
    });
  }
}

export function fillHand(state: GameState) {
  const battle = state.battle!;
  while (battle.hand.length < MAX_HAND_SIZE && battle.buffer.length) battle.hand.push(battle.buffer.shift()!);
}

function recycleEligibleDiscard(state: GameState, eligible: (id: string) => boolean) {
  const battle = state.battle!;
  const available: string[] = [];
  const retained: string[] = [];
  for (const id of battle.discard) (eligible(id) ? available : retained).push(id);
  battle.discard = retained;
  battle.draw.push(...shuffle(state, available));
}

export function draw(state: GameState, count: number, events: GameEvent[] = []) {
  fillHand(state);
  const b = state.battle!;
  recycleDiscard(state);
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = state.team.filter((c) => c.health > 0);
  const eligible = (id: string) => {
    if (!alive.length) return true;
    const ownerId = state.cards.find((card) => card.id === id)?.ownerId;
    return alive.some((unit) => unit.id === ownerId);
  };
  for (let i = 0; i < count; i++) {
    if (!b.draw.some(eligible)) recycleEligibleDiscard(state, eligible);
    let index = b.draw.length - 1;
    while (index >= 0 && !eligible(b.draw[index]!)) index--;
    if (index < 0) break;
    const card = b.draw.splice(index, 1)[0]!;
    receiveDraw(state, card, events);
    recycleDiscard(state);
  }
}

export function drawKeyword(
  state: GameState,
  keyword: "light" | "nature" | "water",
  events: GameEvent[] = [],
) {
  const battle = state.battle;
  if (!battle) return;
  fillHand(state);
  const eligible = (id: string) => {
    const card = state.cards.find((c) => c.id === id)!;
    return (
      state.team.some((c) => c.id === card.ownerId && c.health > 0) && cardKeywords(card).includes(keyword)
    );
  };
  if (!battle.draw.some(eligible)) recycleEligibleDiscard(state, eligible);
  let index = battle.draw.length - 1;
  while (index >= 0 && !eligible(battle.draw[index]!)) index--;
  if (index >= 0) {
    const id = battle.draw.splice(index, 1)[0]!;
    receiveDraw(state, id, events);
    recycleDiscard(state);
  }
}

/** Only the visible hand is exchanged; buffered draws retain their FIFO ownership. */
export function redrawHand(state: GameState, events: GameEvent[]) {
  const battle = state.battle!;
  const returned = battle.hand.splice(0);
  if (!returned.length) return;
  battle.draw.push(...returned);
  shuffle(state, battle.draw);
  draw(state, returned.length, events);
}
