import { boonRule } from "./rules/boons";
import { gainMana, grantBlock, restoreHealth } from "./combat/index";
import type { SupplementalEffect } from "./rules/ability-types";
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
  events.push({
    kind: "action",
    actionType: "support",
    actorId: ownerId,
    text: `${definition(state.cards.find((card) => card.id === id)!.definitionId).name} returns to hand`,
  });
}
/** Cards owned by another living deployed creature can follow a return through Journey Loom. */
function journeyReturnCards(state: GameState, ownerId: string): Set<string> {
  const owners = new Set<string>();
  for (const unit of state.team) if (unit.health > 0 && unit.id !== ownerId) owners.add(unit.id);
  const cards = new Set<string>();
  if (owners.size)
    for (const card of state.cards) if (card.ownerId && owners.has(card.ownerId)) cards.add(card.id);
  return cards;
}

function eligibleJourneyReturn(state: GameState, id: string | undefined, ownerId: string) {
  return state.cards.some(
    (card) =>
      card.id === id &&
      card.ownerId !== null &&
      card.ownerId !== ownerId &&
      state.team.some((unit) => unit.id === card.ownerId && unit.health > 0),
  );
}

/** Inspect the same draw pool without changing its order or revealing a hidden card. */
export function journeyReturnHasDraw(state: BattleState, ownerId: string | null): boolean {
  if (
    !ownerId ||
    !state.boons.includes("journey-loom") ||
    (!state.battle.draw.length && !state.battle.discard.length)
  )
    return false;
  if (state.battle.draw.length + state.battle.discard.length === 1) {
    const id = state.battle.draw[0] ?? state.battle.discard[0];
    return eligibleJourneyReturn(state, id, ownerId);
  }
  const eligible = journeyReturnCards(state, ownerId);
  if (!eligible.size) return false;
  return (
    state.battle.draw.some((id) => eligible.has(id)) || state.battle.discard.some((id) => eligible.has(id))
  );
}

/** Recovery and returns weave in another living deployed owner's ordinary draw. */
export function journeyReturn(state: GameState, ownerId: string | null, events: GameEvent[]) {
  if (!state.battle || !ownerId || !state.boons.includes("journey-loom")) return;
  fillHand(state);
  if (!state.battle.draw.length && !state.battle.discard.length) return;
  if (state.battle.draw.length + state.battle.discard.length === 1) {
    const id = state.battle.draw[0] ?? state.battle.discard[0];
    if (eligibleJourneyReturn(state, id, ownerId))
      drawEligibleCard(state, (candidate) => candidate === id, events);
    return;
  }
  const eligible = journeyReturnCards(state, ownerId);
  if (eligible.size) drawEligibleCard(state, (id) => eligible.has(id), events);
}
export function receiveDraw(state: GameState, id: string, events: GameEvent[]) {
  queueCard(state.battle!, handCapacity(state), id);
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
    queueCard(state.battle!, handCapacity(state), copy.id);
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
  const cards = new Map<string, Card>();
  for (const card of state.cards) if (!cards.has(card.id)) cards.set(card.id, card);
  const result: Card[] | undefined = firstOnly ? undefined : [];
  for (const id of state.battle!.discard) {
    const card = cards.get(id)!;
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
  if (!state.battle!.discard.length) return false;
  if (state.battle!.discard.length === 1) {
    const card = state.cards.find((entry) => entry.id === state.battle!.discard[0])!;
    if (otherOwnerId === undefined) return card.ownerId === null || drawableOwnerIds(state).has(card.ownerId);
    return (
      card.ownerId !== null &&
      card.ownerId !== otherOwnerId &&
      state.team.some((unit) => unit.id === card.ownerId && unit.health > 0)
    );
  }
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
  if (!state.battle!.draw.length && !state.battle!.discard.length) return 0;
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = drawableOwnerIds(state);
  const eligibleCards = alive.size ? new Set<string>() : undefined;
  // Well Read only inserts copies into the hand/buffer; draw/discard ownership
  // stays fixed throughout this draw, including recycling between draws.
  if (eligibleCards)
    for (const card of state.cards)
      if (card.ownerId === null || alive.has(card.ownerId)) eligibleCards.add(card.id);
  const eligible = (id: string) => !eligibleCards || eligibleCards.has(id);
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
    const chance = passiveAmount(state, courier.species, "expressDelivery");
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
  if (!state.battle!.draw.length && !state.battle!.discard.length) return false;
  const single =
    state.battle!.draw.length + state.battle!.discard.length === 1
      ? (state.battle!.draw[0] ?? state.battle!.discard[0])
      : undefined;
  if (single !== undefined) {
    if (!state.cards.some((card) => card.id === single && card.ownerId === ownerId)) return false;
    return drawEligibleCard(state, (id) => id === single, events);
  }
  const eligible = new Set<string>();
  for (const card of state.cards) if (card.ownerId === ownerId) eligible.add(card.id);
  if (!eligible.size) return false;
  return drawEligibleCard(state, (id) => eligible.has(id), events);
}

export function drawKeyword(
  state: GameState,
  keyword: "light" | "nature" | "water" | "burn",
  events: GameEvent[] = [],
) {
  if (!state.battle) return;
  fillHand(state);
  if (!state.battle.draw.length && !state.battle.discard.length) return;
  const single =
    state.battle.draw.length + state.battle.discard.length === 1
      ? (state.battle.draw[0] ?? state.battle.discard[0])
      : undefined;
  if (single !== undefined) {
    let owners: Set<string> | undefined;
    if (
      state.cards.some(
        (card) =>
          card.id === single &&
          (card.ownerId === null || (owners ??= drawableOwnerIds(state)).has(card.ownerId)) &&
          cardHasKeyword(card, keyword),
      )
    )
      drawEligibleCard(state, (id) => id === single, events);
    return;
  }
  const owners = drawableOwnerIds(state);
  let eligibleCards: Set<string> | undefined;
  for (const card of state.cards)
    if ((card.ownerId === null || owners.has(card.ownerId)) && cardHasKeyword(card, keyword))
      (eligibleCards ??= new Set()).add(card.id);
  const eligible = eligibleCards;
  if (eligible) drawEligibleCard(state, (id) => eligible.has(id), events);
}

/** Only the visible hand is exchanged; buffered draws retain their FIFO ownership. */
export function redrawHand(state: GameState, events: GameEvent[]) {
  const battle = state.battle!;
  if (!battle.hand.length) return;
  const returned = battle.hand.splice(0);
  battle.draw.push(...returned);
  shuffle(state, battle.draw);
  draw(state, returned.length, events);
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
/** Called while the played card is still in hand; hidden draw order is irrelevant.
 * Buffered cards are promoted independently of the draw; consumed cards cannot be copied on redraw. */
export function drawHasAnotherCard(
  state: BattleState,
  played: Card,
  effect: SupplementalEffect & { kind: "draw" | "drawKeyword" },
): boolean {
  if (state.battle.draw.length || state.battle.discard.length) {
    let owners: Set<string> | undefined;
    const singleId =
      state.battle.draw.length + state.battle.discard.length === 1
        ? (state.battle.draw[0] ?? state.battle.discard[0])
        : undefined;
    const cards = singleId === undefined ? new Map<string, Card>() : undefined;
    if (cards) for (const card of state.cards) if (!cards.has(card.id)) cards.set(card.id, card);
    const eligible = (id: string) => {
      const drawn = cards ? cards.get(id)! : state.cards.find((card) => card.id === id)!;
      return (
        (drawn.ownerId === null || (owners ??= drawableOwnerIds(state)).has(drawn.ownerId)) &&
        (effect.kind === "draw" || cardHasKeyword(drawn, effect.keyword))
      );
    };
    if (state.battle.draw.some(eligible) || state.battle.discard.some(eligible)) return true;
  }
  return (
    !definition(played.definitionId).consume &&
    (effect.kind === "draw" || cardHasKeyword(played, effect.keyword)) &&
    battleCardCapacity(state) > 0 &&
    state.team.some((unit) => unit.health > 0 && passiveAmount(state, unit.species, "wellRead") > 0)
  );
}
