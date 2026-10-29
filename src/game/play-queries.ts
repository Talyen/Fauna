import { hasMendingTargets, playTargeting } from "./mending";
import { healingAllies } from "./battlefield";
import { mostInjured } from "./combat/state";
import { cardActor, unfinishedJourneyLimit } from "./card-actors";
import { definition, species, type CardDefinition } from "./content";
import { cardCost } from "./ability-rules";
import { controlled, maximumHealth } from "./combat/state";
import { battlefieldView, findLivingBattlefield } from "./battlefield";
import { pendingReplacement } from "./team";
import { hasDiscardDrawCard } from "./card-zones";
import type { BattleState, Card, Creature, Enemy, Command } from "./types";

function recipientPool(state: BattleState, def: CardDefinition, mode = playTargeting(def, state)) {
  if (def.effect === "swapChosen") return state.reserves;
  return battlefieldView(state, mode === "enemy" ? "enemy" : "player");
}
function recipientEligible(unit: Creature | Enemy, def: CardDefinition) {
  return (
    (def.effect === "resurrect" ? unit.health === 0 : unit.health > 0) &&
    (def.effect !== "heal" || def.target !== "injured" || unit.health < maximumHealth(unit))
  );
}

/** Explicit recipients only; random/group delivery remains live execution work. */
export function chosenRecipients(state: BattleState, def: CardDefinition, actor?: Creature) {
  const mode = playTargeting(def, state, actor);
  if (def.effect !== "swapChosen" && mode !== "enemy" && mode !== "ally") return [];
  if (hasMendingTargets(state, def, actor)) {
    const living = mostInjured(healingAllies(state, "player"));
    return [
      ...(living ? [living] : []),
      ...state.team.filter((unit) => unit.health === 0),
      ...state.reserves.filter((unit) => unit.health === 0),
    ];
  }
  if (def.effect === "resurrect") {
    const recipients: (Creature | Enemy)[] = [];
    for (const unit of state.team) if (recipientEligible(unit, def)) recipients.push(unit);
    for (const unit of state.reserves) if (recipientEligible(unit, def)) recipients.push(unit);
    return recipients;
  }
  return recipientPool(state, def, mode).filter((unit) => recipientEligible(unit, def));
}

function hasChosenRecipient(
  state: BattleState,
  def: CardDefinition,
  targetId?: string,
  actor?: Creature,
  mode = playTargeting(def, state, actor),
) {
  if (def.effect !== "swapChosen" && mode !== "enemy" && mode !== "ally") return false;
  if (hasMendingTargets(state, def, actor))
    return chosenRecipients(state, def, actor).some((unit) => targetId === undefined || unit.id === targetId);
  const side = mode === "enemy" ? "enemy" : "player";
  if (
    def.effect !== "resurrect" &&
    def.effect !== "swapChosen" &&
    targetId === undefined &&
    (def.effect !== "heal" || def.target !== "injured")
  )
    return !!findLivingBattlefield(state, side);
  const eligible = (unit: Creature | Enemy) =>
    (targetId === undefined || unit.id === targetId) && recipientEligible(unit, def);
  if (def.effect === "resurrect") return state.team.some(eligible) || state.reserves.some(eligible);
  if (def.effect === "swapChosen") return state.reserves.some(eligible);
  return !!findLivingBattlefield(state, side, eligible);
}

export function playTargetError(state: BattleState, def: CardDefinition, actorId: string, targetId?: string) {
  const actor = state.team.find((unit) => unit.id === actorId);
  const mode = playTargeting(def, state, actor);
  if (
    (mode === "enemy" || mode === "ally") &&
    (targetId === undefined || !hasChosenRecipient(state, def, targetId, actor, mode))
  )
    return def.effect === "swapChosen"
      ? "Choose a living backup."
      : def.effect === "heal" && def.target === "injured"
        ? "Choose an injured ally."
        : def.effect === "resurrect"
          ? "Choose a knocked-out ally."
          : mode === "enemy"
            ? "Choose a living enemy."
            : "Choose a living ally.";
  if (mode === "self" && targetId !== undefined && targetId !== actorId)
    return "This ability targets its acting creature.";
  return null;
}

export interface PlayableCard {
  card: Card;
  actor: Creature;
  def: CardDefinition;
}

/** Card-local admission; command admission retains its original validation order. */
export function inspectCardPlay(
  state: BattleState,
  cardId: string,
): ({ allowed: true } & PlayableCard) | { allowed: false; reason: string } {
  return inspectCard(
    state,
    state.cards.find((entry) => entry.id === cardId),
    (def, actor) => hasChosenRecipient(state, def, undefined, actor),
  );
}

function inspectCard(
  state: BattleState,
  card: Card | undefined,
  hasRecipients: (def: CardDefinition, actor: Creature) => boolean,
  inHand = false,
  recoverable?: (actorId: string) => boolean,
): ({ allowed: true } & PlayableCard) | { allowed: false; reason: string } {
  if (!card || (!inHand && !state.battle.hand.includes(card.id)))
    return { allowed: false, reason: "That card is not in your hand." };
  const actor = cardActor(state, card);
  if (!actor || actor.health <= 0) return { allowed: false, reason: "That creature is knocked out." };
  const def = definition(card.definitionId);
  if (card.ownerId !== null && controlled(actor, state, def))
    return {
      allowed: false,
      reason: `${species(actor.species).name} cannot act ${actor.combat?.controlled ? `while ${actor.combat.controlled === "freeze" ? "Frozen" : "Stunned"}` : "this turn"}.`,
    };
  if (
    card.ownerId !== null &&
    actor.id !== card.ownerId &&
    (actor.combat?.fallenCardsPlayedThisTurn ?? 0) >= unfinishedJourneyLimit(state, actor)
  )
    return { allowed: false, reason: "Unfinished Journey’s limit is spent this turn." };
  if (
    def.effect === "recover" &&
    def.allyOnly &&
    !(recoverable?.(actor.id) ?? hasDiscardDrawCard(state, actor.id))
  )
    return { allowed: false, reason: "There are no eligible ally cards in Discard." };
  if (def.effect === "resurrect" && !hasRecipients(def, actor))
    return { allowed: false, reason: "There are no knocked-out allies." };
  if (
    (def.effect === "swapChosen" && !hasRecipients(def, actor)) ||
    (def.effect === "swapThorns" && !state.reserves.some((unit) => unit.health > 0))
  )
    return { allowed: false, reason: "There are no living backups." };
  if (def.effect === "heal" && def.target === "injured" && !hasRecipients(def, actor))
    return { allowed: false, reason: "There are no injured allies." };
  if (state.battle.mana < cardCost(card, state, def, actor))
    return { allowed: false, reason: "Not enough Mana." };
  return { allowed: true, card, actor, def };
}

export interface AvailablePlay extends PlayableCard {
  commands: Extract<Command, { type: "play" }>[];
}

/** Automatic turn completion only needs to know whether any command exists. */
export function hasAvailablePlay(state: BattleState): boolean {
  if (!state.battle.hand.length || pendingReplacement(state)) return false;
  let cards: Map<string, Card> | undefined;
  let firstKey: string | undefined;
  let firstRecipients = false;
  let otherRecipients: Map<string, boolean> | undefined;
  const hasRecipients = (def: CardDefinition, actor: Creature) => {
    const key = `${def.id}:${actor.id}`;
    if (firstKey === undefined) {
      firstKey = key;
      return (firstRecipients = hasChosenRecipient(state, def, undefined, actor));
    }
    if (firstKey === key) return firstRecipients;
    otherRecipients ??= new Map();
    let result = otherRecipients.get(key);
    if (result === undefined)
      otherRecipients.set(key, (result = hasChosenRecipient(state, def, undefined, actor)));
    return result;
  };
  let firstActorId: string | undefined;
  let firstRecoverable = false;
  let otherRecoverable: Map<string, boolean> | undefined;
  const canRecover = (actorId: string) => {
    if (firstActorId === undefined) {
      firstActorId = actorId;
      return (firstRecoverable = hasDiscardDrawCard(state, actorId));
    }
    if (firstActorId === actorId) return firstRecoverable;
    otherRecoverable ??= new Map();
    let result = otherRecoverable.get(actorId);
    if (result === undefined) otherRecoverable.set(actorId, (result = hasDiscardDrawCard(state, actorId)));
    return result;
  };
  for (let index = 0; index < state.battle.hand.length; index++) {
    const id = state.battle.hand[index]!;
    if (index === 1) {
      cards = new Map<string, Card>();
      for (const card of state.cards) if (!cards.has(card.id)) cards.set(card.id, card);
    }
    const play = inspectCard(
      state,
      cards ? cards.get(id) : state.cards.find((card) => card.id === id),
      hasRecipients,
      true,
      canRecover,
    );
    if (!play.allowed) continue;
    const mode = playTargeting(play.def, state, play.actor);
    if ((mode !== "enemy" && mode !== "ally") || hasRecipients(play.def, play.actor)) return true;
  }
  return false;
}

/** Enumerate legal commands without previewing, choosing random recipients or touching RNG. */
export function availablePlays(state: BattleState, autoEndTurn = true): AvailablePlay[] {
  if (!state.battle.hand.length || pendingReplacement(state)) return [];
  const cards = state.battle.hand.length > 1 ? new Map<string, Card>() : undefined;
  if (cards) for (const card of state.cards) if (!cards.has(card.id)) cards.set(card.id, card);
  let recipientsByActor: Map<string, ReturnType<typeof chosenRecipients>> | undefined;
  const recipients = (def: CardDefinition, actor: Creature) => {
    const key = `${def.id}:${actor.id}`;
    recipientsByActor ??= new Map();
    let result = recipientsByActor.get(key);
    if (!result) recipientsByActor.set(key, (result = chosenRecipients(state, def, actor)));
    return result;
  };
  const hasRecipients = (def: CardDefinition, actor: Creature) => recipients(def, actor).length > 0;
  let recoverableByActor: Map<string, boolean> | undefined;
  const recoverable = (actorId: string) => {
    recoverableByActor ??= new Map();
    let result = recoverableByActor.get(actorId);
    if (result === undefined) recoverableByActor.set(actorId, (result = hasDiscardDrawCard(state, actorId)));
    return result;
  };
  const plays: AvailablePlay[] = [];
  for (const cardId of state.battle.hand) {
    const play = inspectCard(
      state,
      cards ? cards.get(cardId) : state.cards.find((card) => card.id === cardId),
      hasRecipients,
      true,
      recoverable,
    );
    if (!play.allowed) continue;
    const mode = playTargeting(play.def, state, play.actor);
    const commands =
      mode === "enemy" || mode === "ally"
        ? recipients(play.def, play.actor).map((unit) => ({
            type: "play" as const,
            cardId,
            targetId: unit.id,
            autoEndTurn,
          }))
        : [{ type: "play" as const, cardId, targetId: undefined, autoEndTurn }];
    plays.push({
      card: play.card,
      actor: play.actor,
      def: play.def,
      commands,
    });
  }
  return plays;
}
