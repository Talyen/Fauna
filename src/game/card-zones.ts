import { boonRule } from "./rules/boons";
import { gainMana, grantBlock, restoreHealth } from "./combat/index";
import type { SupplementalEffect } from "./rules/ability-types";
import { cardActor, drawableOwnerIds } from "./card-actors";
import { definition, species } from "./content";
import type { BattleState, Card, GameEvent, GameState } from "./types";
import { chance as succeeds } from "./chance";
import { shuffle, hiddenDecision, roll } from "./random";
import { cardKeywords, creaturePassive } from "./progression";

export const MAX_HAND_SIZE = 6;
export const MAX_SUPPORTED_HAND_SIZE = MAX_HAND_SIZE + boonRule("facet-abacus").slots;
export function handCapacity(state: Pick<GameState, "boons">) {
  return MAX_HAND_SIZE + (state.boons.includes("facet-abacus") ? boonRule("facet-abacus").slots : 0);
}
// Bound generated cards and their overflow within the supported save size.
export const MAX_BATTLE_CARDS = 256;

/** Preserve pile order while retiring or relocating slots across the whole battle. */
export function filterCardZones(battle: BattleState["battle"], keep: (id: string) => boolean) {
  for (const zone of ["draw", "hand", "buffer", "discard"] as const) battle[zone] = battle[zone].filter(keep);
}

function queueCard(state: GameState, id: string) {
  const battle = state.battle!;
  (battle.hand.length < handCapacity(state) ? battle.hand : battle.buffer).push(id);
}

export function recycleDiscard(
  state: GameState,
  zones: { draw: string[]; discard: string[] } = state.battle!,
) {
  if (!zones.draw.length && zones.discard.length) zones.draw.push(...shuffle(state, zones.discard.splice(0)));
}
export function receiveCard(state: GameState, id: string) {
  fillHand(state);
  queueCard(state, id);
}

/** Return an existing owner slot; returns do not draw, copy, or award draw reactions */
export function recoverBrokenGuard(state: GameState, ownerId: string, events: GameEvent[]) {
  if (
    !state.battle ||
    !state.boons.includes("cloud-cup-and-ball") ||
    !state.team.some((unit) => unit.id === ownerId && unit.health > 0)
  )
    return;
  const available = state.battle.discard.filter((id) =>
    state.cards.some((card) => card.id === id && card.ownerId === ownerId),
  );
  if (!available.length) return;
  const id =
    available[
      available.length === 1
        ? 0
        : Math.floor(roll(state, { kind: "index", size: available.length }) * available.length)
    ]!;
  state.battle.discard.splice(state.battle.discard.indexOf(id), 1);
  receiveCard(state, id);
  journeyReturn(state, ownerId, events);
  events.push({
    kind: "action",
    actionType: "support",
    actorId: ownerId,
    text: `${definition(state.cards.find((card) => card.id === id)!.definitionId).name} returns to hand`,
  });
}
/** Recovery and returns weave in another living deployed owner's ordinary draw. */
export function journeyReturn(state: GameState, ownerId: string | null, events: GameEvent[]) {
  if (!state.battle || !ownerId || !state.boons.includes("journey-loom")) return;
  const owners = new Set(
    state.team.filter((unit) => unit.health > 0 && unit.id !== ownerId).map((unit) => unit.id),
  );
  const eligible = new Set(
    state.cards.filter((card) => card.ownerId && owners.has(card.ownerId)).map((card) => card.id),
  );
  fillHand(state);
  drawEligibleCard(state, (id) => eligible.has(id), events);
}
export function receiveDraw(state: GameState, id: string, events: GameEvent[]) {
  const battle = state.battle!;
  queueCard(state, id);
  const owner = state.team.find(
    (unit) => unit.id === state.cards.find((card) => card.id === id)?.ownerId && unit.health > 0,
  );
  if (owner && state.boons.includes("dune-shuttle"))
    grantBlock(state, owner, boonRule("dune-shuttle").block, events);
  let original: GameState["cards"][number] | undefined;
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
    original ??= state.cards.find((entry) => entry.id === id)!;
    const copy = { ...original, id: `copy-${battle.copySerial++}`, temporary: true as const };
    state.cards.push(copy);
    queueCard(state, copy.id);
    events.push({
      kind: "action",
      actionType: "support",
      actorId: reader.id,
      targetId: original.ownerId ?? undefined,
      text: `${species(reader.species).name} copies ${definition(original.definitionId).name} with Well Read`,
    });
  }
}

/** Direct Discard draws heal the original owner; recycling, copies and promotion do not. */
export function lostAndFound(state: GameState, card: Card, events: GameEvent[]) {
  const owner = state.team.find((unit) => unit.id === card.ownerId && unit.health > 0);
  if (!owner) return;
  for (const keeper of state.team) {
    if (keeper.health <= 0) continue;
    const amount = creaturePassive(state, keeper.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "lostAndFound" ? effect.amount : 0),
      0,
    );
    if (amount > 0) restoreHealth(owner, amount, events, false, state, false, keeper);
  }
}

export function discardDrawCards(state: GameState, otherOwnerId?: string): Card[] {
  const owners = drawableOwnerIds(state);
  return state.battle!.discard.flatMap((id) => {
    const card = state.cards.find((entry) => entry.id === id)!;
    return (
      otherOwnerId === undefined
        ? card.ownerId === null || owners.has(card.ownerId)
        : card.ownerId !== null &&
          card.ownerId !== otherOwnerId &&
          state.team.some((unit) => unit.id === card.ownerId && unit.health > 0)
    )
      ? [card]
      : [];
  });
}

export function drawDiscard(state: GameState, events: GameEvent[], otherOwnerId?: string): Card | undefined {
  const battle = state.battle!;
  const available = discardDrawCards(state, otherOwnerId);
  if (!available.length) return;
  const card =
    available[Math.floor(roll(state, { kind: "index", size: available.length }) * available.length)]!;
  const id = card.id;
  battle.discard.splice(battle.discard.indexOf(id), 1);
  fillHand(state);
  receiveDraw(state, id, events);
  events.push({
    kind: "action",
    actionType: "support",
    actorId: card.ownerId ?? cardActor(state, card)!.id,
    text: `${definition(card.definitionId).name} is drawn from Discard`,
  });
  lostAndFound(state, card, events);
  journeyReturn(state, card.ownerId, events);
  return card;
}

export function fillHand(state: GameState) {
  const battle = state.battle!;
  const count = Math.min(handCapacity(state) - battle.hand.length, battle.buffer.length);
  if (count > 0) battle.hand.push(...battle.buffer.splice(0, count));
}

function recycleEligibleDiscard(state: GameState, eligible: (id: string) => boolean) {
  const battle = state.battle!;
  const available: string[] = [];
  const retained: string[] = [];
  for (const id of battle.discard) (eligible(id) ? available : retained).push(id);
  battle.discard = retained;
  battle.draw.push(...shuffle(state, available));
}

function lastEligibleIndex(ids: readonly string[], eligible: (id: string) => boolean) {
  let index = ids.length - 1;
  while (index >= 0 && !eligible(ids[index]!)) index--;
  return index;
}

/** Deliver one actual draw, including copies and overflow, without disturbing ineligible slots. */
export function drawEligibleCard(state: GameState, eligible: (id: string) => boolean, events: GameEvent[]) {
  const battle = state.battle!;
  let index = lastEligibleIndex(battle.draw, eligible);
  // An empty eligible pool is a visible no-op, not an unknown hidden draw.
  if (index < 0 && !battle.discard.some(eligible)) return false;
  hiddenDecision(state);
  if (index < 0) {
    recycleEligibleDiscard(state, eligible);
    index = lastEligibleIndex(battle.draw, eligible);
  }
  if (index < 0) return false;
  const id = battle.draw.splice(index, 1)[0]!;
  const last = battle.draw.length === 0;
  receiveDraw(state, id, events);
  if (last && state.boons.includes("mineral-bookend"))
    gainMana(state, boonRule("mineral-bookend").mana, events);
  recycleDiscard(state);
  return true;
}

export function draw(state: GameState, count: number, events: GameEvent[] = []) {
  if (count <= 0) return 0;
  fillHand(state);
  // Ordinary draws reshuffle the whole empty pile first; keyword draws only recycle matches.
  recycleDiscard(state);
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = drawableOwnerIds(state);
  const eligibleCards = new Set<string>();
  // Well Read only inserts copies into the hand/buffer; draw/discard ownership
  // stays fixed throughout this draw, including recycling between draws.
  if (alive.size)
    for (const card of state.cards)
      if (card.ownerId === null || alive.has(card.ownerId)) eligibleCards.add(card.id);
  const eligible = (id: string) => !alive.size || eligibleCards.has(id);
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (!drawEligibleCard(state, eligible, events)) break;
    drawn++;
  }
  return drawn;
}

/** One delivery per living deployed courier at each turn start, including the opening. */
export function expressDelivery(state: GameState, events: GameEvent[]) {
  for (const courier of state.team) {
    if (courier.health <= 0) continue;
    const chance = creaturePassive(state, courier.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "expressDelivery" ? effect.amount : 0),
      0,
    );
    if (succeeds(state, chance / 100, false, events) && draw(state, 1, events))
      events.push({
        kind: "action",
        actionType: "support",
        actorId: courier.id,
        text: "Express Delivery draws an extra card",
      });
  }
}

export function drawOwner(state: GameState, ownerId: string, events: GameEvent[]) {
  fillHand(state);
  const eligible = new Set(state.cards.filter((card) => card.ownerId === ownerId).map((card) => card.id));
  return drawEligibleCard(state, (id) => eligible.has(id), events);
}

export function drawKeyword(
  state: GameState,
  keyword: "light" | "nature" | "water" | "burn",
  events: GameEvent[] = [],
) {
  if (!state.battle) return;
  fillHand(state);
  const owners = drawableOwnerIds(state);
  const eligibleCards = new Set(
    state.cards
      .filter(
        (card) => (card.ownerId === null || owners.has(card.ownerId)) && cardKeywords(card).includes(keyword),
      )
      .map((card) => card.id),
  );
  drawEligibleCard(state, (id) => eligibleCards.has(id), events);
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

/** Shared capacity query for generated cards and visible policy assessment. */
export function battleCardCapacity(state: Pick<GameState, "cards">): number {
  return Math.max(0, MAX_BATTLE_CARDS - state.cards.length);
}
/** Called while the played card is still in hand; hidden draw order is irrelevant.
 * Buffered cards fill the hand before keyword filtering; consumed cards cannot be copied on redraw. */
export function drawHasAnotherCard(
  state: BattleState,
  played: Card,
  effect: SupplementalEffect & { kind: "draw" | "drawKeyword" },
): boolean {
  return (
    [...state.battle.draw, ...state.battle.discard, ...state.battle.buffer].some((id) => {
      const drawn = state.cards.find((entry) => entry.id === id)!;
      return (
        (drawn.ownerId === null || drawableOwnerIds(state).has(drawn.ownerId)) &&
        (state.battle.buffer.includes(id) ||
          effect.kind === "draw" ||
          cardKeywords(drawn).includes(effect.keyword))
      );
    }) ||
    (!definition(played.definitionId).consume &&
      (effect.kind === "draw" || cardKeywords(played).includes(effect.keyword)) &&
      battleCardCapacity(state) > 0 &&
      state.team.some(
        (unit) =>
          unit.health > 0 &&
          creaturePassive(state, unit.species).effects.some(
            (passive) => passive.kind === "wellRead" && passive.amount > 0,
          ),
      ))
  );
}
