import { emitSupport } from "./events";
import { boonRule } from "./rules/boons";
import { grantBlock, restoreHealth } from "./combat/index";
import type { SupplementalEffect } from "./rules/ability-types";
import { livingBattlefield } from "./battlefield";
import { cardActor, drawableOwnerIds } from "./card-actors";
import { definition, species } from "./content";
import type { BattleState, Card, GameEvent, GameState } from "./types";
import { chance as succeeds } from "./chance";
import { shuffle, hiddenDecision, roll } from "./random";
import { cardHasKeyword, passiveAmount } from "./progression";

export const MAX_HAND_SIZE = 6;
export const MAX_SUPPORTED_HAND_SIZE = MAX_HAND_SIZE + boonRule("facet-abacus").slots;
export function handCapacity(state: Pick<GameState, "boons">) {
  return MAX_HAND_SIZE + (state.boons.includes("facet-abacus") ? boonRule("facet-abacus").slots : 0);
}
// Bound generated cards and their overflow within the supported save size.
export const MAX_BATTLE_CARDS = 256;

const CARD_ZONES = ["draw", "hand", "buffer", "discard"] as const;
/** Preserve pile order while retiring or relocating slots across the whole battle. */
export function filterCardZones(battle: BattleState["battle"], keep: (id: string) => boolean) {
  for (const zone of CARD_ZONES) {
    const cards = battle[zone];
    let kept: string[] | undefined;
    for (let index = 0; index < cards.length; index++) {
      const id = cards[index]!;
      if (keep(id)) kept?.push(id);
      else kept ??= cards.slice(0, index);
    }
    if (kept) battle[zone] = kept;
  }
}

type HandZones = Pick<BattleState["battle"], "hand" | "buffer">;

/** Promotion is not a draw: retain FIFO order without triggering draw reactions. */
export function promoteBufferedCards(zones: HandZones, capacity: number) {
  const count = Math.min(capacity - zones.hand.length, zones.buffer.length);
  if (count > 0) zones.hand.push(...zones.buffer.splice(0, count));
}

export function queueCard(zones: HandZones, capacity: number, id: string) {
  (zones.hand.length < capacity ? zones.hand : zones.buffer).push(id);
}

export function recycleDiscard(
  state: GameState,
  zones: { draw: string[]; discard: string[] } = state.battle!,
) {
  if (!zones.draw.length && zones.discard.length) zones.draw.push(...shuffle(state, zones.discard.splice(0)));
}
export function receiveCard(state: GameState, id: string) {
  fillHand(state);
  queueCard(state.battle!, handCapacity(state), id);
}

export function rememberSlipperCard(state: GameState, ownerId: string, card: Card) {
  if (!state.boons.includes("crystal-slipper")) return;
  const owner = state.team.find((unit) => unit.id === ownerId);
  if (owner?.combat) owner.combat.slipperCard = card.id;
}

export function returnSlipperCard(state: GameState, ownerId: string, events: GameEvent[]) {
  if (!state.battle || !state.boons.includes("crystal-slipper")) return;
  const owner = state.team.find((unit) => unit.id === ownerId && unit.health > 0);
  const id = owner?.combat?.slipperCard;
  if (!id || !state.cards.some((card) => card.id === id && cardActor(state, card)?.id === ownerId)) return;
  if (!state.battle.draw.includes(id) && !state.battle.discard.includes(id)) return;
  filterCardZones(state.battle, (candidate) => candidate !== id);
  receiveCard(state, id);
  journeyReturn(state, ownerId, events);
  emitSupport(events, ownerId, { text: "Crystal Slipper returns the last played card to hand" });
}

export function controlRecoveryDraw(state: GameState, ownerId: string, events: GameEvent[]) {
  if (
    !state.battle ||
    !state.boons.includes("cuckoo-whistle") ||
    !state.team.some((unit) => unit.id === ownerId && unit.health > 0)
  )
    return;
  drawOwner(state, ownerId, events);
}

/** Return an existing owner slot; returns do not draw, copy, or award draw reactions */
export function recoverBrokenGuard(state: GameState, ownerId: string, events: GameEvent[]) {
  if (
    !state.battle ||
    !state.battle.discard.length ||
    !state.boons.includes("cloud-cup-and-ball") ||
    !state.team.some((unit) => unit.id === ownerId && unit.health > 0)
  )
    return;
  const discard = state.battle.discard;
  let available: string[];
  if (discard.length === 1) {
    if (!state.cards.some((card) => card.ownerId === ownerId && card.id === discard[0])) return;
    available = [discard[0]!];
  } else {
    const owned = new Set<string>();
    for (const card of state.cards) if (card.ownerId === ownerId) owned.add(card.id);
    if (!owned.size) return;
    available = discard.filter((id) => owned.has(id));
  }
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
  emitSupport(events, ownerId, {
    text: `${definition(state.cards.find((card) => card.id === id)!.definitionId).name} returns to hand`,
  });
}
/** Build a membership query without changing or exposing the hidden draw order. */
function eligibleDrawPool(state: GameState, matches: (card: Card) => boolean) {
  const { draw } = state.battle!;
  if (!draw.length) return;
  if (draw.length === 1) {
    const id = draw[0];
    return state.cards.some((card) => card.id === id && matches(card))
      ? (candidate: string) => candidate === id
      : undefined;
  }
  const pool = new Set(draw);
  const ids = new Set<string>();
  for (const card of state.cards) if (pool.has(card.id) && matches(card)) ids.add(card.id);
  if (!ids.size) return;
  return (id: string) => ids.has(id);
}

/** Keyword draws and their visible benefit query use identical owner eligibility. */
function drawableCard(state: GameState, keyword?: "light" | "nature" | "water" | "burn") {
  let owners: Set<string> | undefined;
  return (card: Card) =>
    (card.ownerId === null || (owners ??= drawableOwnerIds(state)).has(card.ownerId)) &&
    (!keyword || cardHasKeyword(card, keyword));
}

/** Find cards belonging to another living deployed creature without revealing pile order. */
export function journeyReturnEligibility(
  state: GameState,
  ownerId: string | null,
): ((id: string) => boolean) | undefined {
  if (!state.battle || !ownerId || !state.boons.includes("journey-loom")) return;
  let owners: Set<string> | undefined;
  return eligibleDrawPool(state, (card) => {
    if (!card.ownerId || card.ownerId === ownerId) return false;
    if (!owners) {
      owners = new Set();
      for (const unit of state.team) if (unit.health > 0) owners.add(unit.id);
    }
    return owners.has(card.ownerId);
  });
}

/** Inspect the same draw pool without changing its order or revealing a hidden card. */
export function journeyReturnHasDraw(state: BattleState, ownerId: string | null): boolean {
  return !!journeyReturnEligibility(state, ownerId);
}

/** Recovery and returns weave in another living deployed owner's ordinary draw. */
export function journeyReturn(state: GameState, ownerId: string | null, events: GameEvent[]) {
  if (!state.battle || !ownerId || !state.boons.includes("journey-loom")) return;
  fillHand(state);
  const eligible = journeyReturnEligibility(state, ownerId);
  if (eligible) drawEligibleCard(state, eligible, events);
}
export function receiveDraw(state: GameState, id: string, events: GameEvent[]) {
  const capacity = handCapacity(state);
  queueCard(state.battle!, capacity, id);
  let original: Card | undefined;
  const originalCard = () => (original ??= state.cards.find((card) => card.id === id));
  if (state.boons.includes("dune-shuttle")) {
    const ownerId = originalCard()?.ownerId;
    const owner = state.team.find((unit) => unit.id === ownerId && unit.health > 0);
    if (owner) grantBlock(state, owner, boonRule("dune-shuttle").block, events);
  }
  // Copy insertion and buffer promotion are not draws and cannot recursively copy.
  for (const reader of state.team) {
    if (reader.health <= 0) continue;
    const chance = passiveAmount(state, reader.species, "wellRead");
    if (chance <= 0) continue;
    if (battleCardCapacity(state) === 0) break;
    if (!succeeds(state, chance / 100, false, events)) continue;
    const original = originalCard()!;
    const copy = createTemporaryCard(state, original)!;
    queueCard(state.battle!, capacity, copy.id);
    emitSupport(events, reader.id, {
      targetId: original.ownerId ?? undefined,
      text: `${species(reader.species).name} copies ${definition(original.definitionId).name} with Well Read`,
    });
  }
}

/** Direct Discard draws heal the original owner; recycling, copies and promotion do not. */
export function lostAndFound(state: GameState, card: Card, events: GameEvent[]) {
  if (card.ownerId === null) return;
  const owner = state.team.find((unit) => unit.id === card.ownerId && unit.health > 0);
  if (!owner) return;
  for (const keeper of state.team) {
    if (keeper.health <= 0) continue;
    const amount = passiveAmount(state, keeper.species, "lostAndFound");
    if (amount > 0) restoreHealth(owner, amount, events, false, state, false, keeper);
  }
}

function discardDrawPool(state: GameState, otherOwnerId: string | undefined, firstOnly: true): boolean;
function discardDrawPool(state: GameState, otherOwnerId?: string, firstOnly?: false): Card[];
function discardDrawPool(state: GameState, otherOwnerId?: string, firstOnly = false): Card[] | boolean {
  if (!state.battle!.discard.length) return firstOnly ? false : [];
  if (state.battle!.discard.length === 1) {
    const card = state.cards.find((entry) => entry.id === state.battle!.discard[0])!;
    const eligible =
      otherOwnerId === undefined
        ? card.ownerId === null || drawableOwnerIds(state).has(card.ownerId)
        : card.ownerId !== null &&
          card.ownerId !== otherOwnerId &&
          state.team.some((unit) => unit.id === card.ownerId && unit.health > 0);
    return firstOnly ? eligible : eligible ? [card] : [];
  }
  let owners: Set<string> | undefined;
  const livingOwners = otherOwnerId === undefined ? undefined : new Set<string>();
  if (livingOwners) for (const unit of state.team) if (unit.health > 0) livingOwners.add(unit.id);
  let cards: Map<string, Card> | undefined;
  const result: Card[] | undefined = firstOnly ? undefined : [];
  const discard = state.battle!.discard;
  for (let index = 0; index < discard.length; index++) {
    const id = discard[index]!;
    if ((!firstOnly && index === 0) || (firstOnly && index === 1)) {
      cards = new Map<string, Card>();
      for (const card of state.cards) if (!cards.has(card.id)) cards.set(card.id, card);
    }
    const card = cards ? cards.get(id)! : state.cards.find((entry) => entry.id === id)!;
    if (
      otherOwnerId === undefined
        ? card.ownerId === null || (owners ??= drawableOwnerIds(state)).has(card.ownerId)
        : card.ownerId !== null && card.ownerId !== otherOwnerId && livingOwners!.has(card.ownerId)
    ) {
      if (firstOnly) return true;
      result!.push(card);
    }
  }
  return result ?? false;
}

export function discardDrawCards(state: GameState, otherOwnerId?: string): Card[] {
  return discardDrawPool(state, otherOwnerId);
}

/** Eligibility checks do not need to enumerate the complete ordered draw pool. */
export function hasDiscardDrawCard(state: GameState, otherOwnerId?: string): boolean {
  return discardDrawPool(state, otherOwnerId, true);
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
  emitSupport(events, card.ownerId ?? cardActor(state, card)!.id, {
    text: `${definition(card.definitionId).name} is drawn from Discard`,
  });
  lostAndFound(state, card, events);
  journeyReturn(state, card.ownerId, events);
  return card;
}

export function fillHand(state: GameState) {
  promoteBufferedCards(state.battle!, handCapacity(state));
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
  const index = lastEligibleIndex(battle.draw, eligible);
  // Discard is unavailable to ordinary draws until the next turn starts.
  if (index < 0) return false;
  hiddenDecision(state);
  const id = index === battle.draw.length - 1 ? battle.draw.pop()! : battle.draw.splice(index, 1)[0]!;
  const last = battle.draw.length === 0;
  receiveDraw(state, id, events);
  if (last && state.boons.includes("mineral-bookend"))
    for (const ally of livingBattlefield(state, "player"))
      grantBlock(state, ally, boonRule("mineral-bookend").block, events);
  return true;
}

export function draw(state: GameState, count: number, events: GameEvent[] = []) {
  return drawCards(state, count, events, false);
}

/** Only turn-start draws may refill the deck, including across the opening draw. */
export function drawAtTurnStart(state: GameState, count: number, events: GameEvent[]) {
  return drawCards(state, count, events, true);
}

function drawCards(state: GameState, count: number, events: GameEvent[], turnStart: boolean) {
  if (count <= 0) return 0;
  fillHand(state);
  if (!state.battle!.draw.length && (!turnStart || !state.battle!.discard.length)) return 0;
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = drawableOwnerIds(state);
  const eligibleCards = alive.size ? new Set<string>() : undefined;
  // Well Read inserts copies into hand/overflow without changing draw eligibility.
  if (eligibleCards)
    for (const card of state.cards)
      if (card.ownerId === null || alive.has(card.ownerId)) eligibleCards.add(card.id);
  const eligible = (id: string) => !eligibleCards || eligibleCards.has(id);
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    // Retain fallen owners' inert slots without letting them prevent the next refill.
    if (turnStart && !state.battle!.draw.some(eligible)) recycleEligibleDiscard(state, eligible);
    if (!drawEligibleCard(state, eligible, events)) break;
    drawn++;
  }
  return drawn;
}

/** One delivery per living deployed courier at each turn start, including the opening. */
export function expressDelivery(state: GameState, events: GameEvent[]) {
  for (const courier of state.team) {
    if (courier.health <= 0) continue;
    const chance = passiveAmount(state, courier.species, "expressDelivery");
    if (succeeds(state, chance / 100, false, events) && draw(state, 1, events))
      emitSupport(events, courier.id, { text: "Express Delivery draws an extra card" });
  }
}

export function drawOwner(state: GameState, ownerId: string, events: GameEvent[]) {
  fillHand(state);
  const eligible = eligibleDrawPool(state, (card) => card.ownerId === ownerId);
  return eligible ? drawEligibleCard(state, eligible, events) : false;
}

export function drawKeyword(
  state: GameState,
  keyword: "light" | "nature" | "water" | "burn",
  events: GameEvent[] = [],
) {
  if (!state.battle) return;
  fillHand(state);
  const eligible = eligibleDrawPool(state, drawableCard(state, keyword));
  if (eligible) drawEligibleCard(state, eligible, events);
}

/** Only the visible hand is exchanged; buffered draws retain their FIFO ownership. */
export function redrawHand(state: GameState, events: GameEvent[]) {
  const battle = state.battle!;
  if (!battle.hand.length) return;
  const count = battle.hand.length;
  battle.draw.push(...battle.hand);
  battle.hand.length = 0;
  shuffle(state, battle.draw);
  draw(state, count, events);
}

/** Shared capacity query for generated cards and visible policy assessment. */
export function battleCardCapacity(state: Pick<GameState, "cards" | "battle">): number {
  return Math.max(
    0,
    Math.min(
      MAX_BATTLE_CARDS - state.cards.length,
      Number.MAX_SAFE_INTEGER - (state.battle?.copySerial ?? 0),
    ),
  );
}
/** Own capacity, serial allocation and insertion together for every generated card. */
export function createTemporaryCard(
  state: Pick<GameState, "cards" | "battle">,
  card: Omit<Card, "id" | "temporary">,
): Card | undefined {
  if (!state.battle || battleCardCapacity(state) === 0) return;
  const copy: Card = {
    id: `copy-${state.battle.copySerial++}`,
    definitionId: card.definitionId,
    ownerId: card.ownerId,
    level: card.level,
    temporary: true,
  };
  state.cards.push(copy);
  return copy;
}
/** Inspect actual drawable cards without sampling or including the played card's future Discard slot. */
export function drawHasAnotherCard(
  state: BattleState,
  _played: Card,
  effect: SupplementalEffect & { kind: "draw" | "drawKeyword" },
): boolean {
  return !!eligibleDrawPool(
    state,
    drawableCard(state, effect.kind === "drawKeyword" ? effect.keyword : undefined),
  );
}
