import { cardActor, unfinishedJourneyLimit } from "./card-actors";
import { cardTargeting } from "./card-rules";
import { definition, species, type CardDefinition } from "./content";
import { cardCost } from "./ability-rules";
import { controlled, maximumHealth } from "./combat/state";
import { battlefield } from "./battlefield";
import { pendingReplacement } from "./team";
import { discardDrawCards } from "./card-zones";
import type { BattleState, Card, Creature, Enemy, Command } from "./types";

function recipientPool(state: BattleState, def: CardDefinition) {
  if (def.effect === "swapChosen") return state.reserves;
  if (def.effect === "resurrect") return [...state.team, ...state.reserves];
  return battlefield(state, cardTargeting(def, state) === "enemy" ? "enemy" : "player");
}
function recipientEligible(unit: Creature | Enemy, def: CardDefinition) {
  return (
    (def.effect === "resurrect" ? unit.health === 0 : unit.health > 0) &&
    (def.effect !== "heal" || def.target !== "injured" || unit.health < maximumHealth(unit))
  );
}

/** Explicit recipients only; random/group delivery remains live execution work. */
export function chosenRecipients(state: BattleState, def: CardDefinition) {
  const mode = cardTargeting(def, state);
  if (def.effect !== "swapChosen" && mode !== "enemy" && mode !== "ally") return [];
  return recipientPool(state, def).filter((unit) => recipientEligible(unit, def));
}

export function playTargetError(state: BattleState, def: CardDefinition, actorId: string, targetId?: string) {
  const mode = cardTargeting(def, state);
  if (
    (mode === "enemy" || mode === "ally") &&
    !recipientPool(state, def).some((unit) => unit.id === targetId && recipientEligible(unit, def))
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
    (def) => chosenRecipients(state, def),
  );
}

function inspectCard(
  state: BattleState,
  card: Card | undefined,
  recipients: (def: CardDefinition) => ReturnType<typeof chosenRecipients>,
): ({ allowed: true } & PlayableCard) | { allowed: false; reason: string } {
  if (!card || !state.battle.hand.includes(card.id))
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
  if (def.effect === "recover" && def.allyOnly && !discardDrawCards(state, actor.id).length)
    return { allowed: false, reason: "There are no eligible ally cards in Discard." };
  if (def.effect === "resurrect" && !recipients(def).length)
    return { allowed: false, reason: "There are no knocked-out allies." };
  if (def.effect === "swapChosen" && !recipients(def).length)
    return { allowed: false, reason: "There are no living backups." };
  if (def.effect === "heal" && def.target === "injured" && !recipients(def).length)
    return { allowed: false, reason: "There are no injured allies." };
  if (state.battle.mana < cardCost(card, state)) return { allowed: false, reason: "Not enough Mana." };
  return { allowed: true, card, actor, def };
}

export interface AvailablePlay extends PlayableCard {
  commands: Extract<Command, { type: "play" }>[];
}

/** Enumerate legal commands without previewing, choosing random recipients or touching RNG. */
export function availablePlays(state: BattleState, autoEndTurn = true): AvailablePlay[] {
  if (pendingReplacement(state) || !state.battle.hand.length) return [];
  const cards = state.battle.hand.length > 1 ? new Map<string, Card>() : undefined;
  if (cards) for (const card of state.cards) if (!cards.has(card.id)) cards.set(card.id, card);
  const recipientsByDefinition = new Map<CardDefinition, ReturnType<typeof chosenRecipients>>();
  const recipients = (def: CardDefinition) => {
    let result = recipientsByDefinition.get(def);
    if (!result) recipientsByDefinition.set(def, (result = chosenRecipients(state, def)));
    return result;
  };
  return state.battle.hand.flatMap((cardId) => {
    const play = inspectCard(
      state,
      cards ? cards.get(cardId) : state.cards.find((card) => card.id === cardId),
      recipients,
    );
    if (!play.allowed) return [];
    const mode = cardTargeting(play.def, state);
    const ids =
      mode === "enemy" || mode === "ally" ? recipients(play.def).map((unit) => unit.id) : [undefined];
    return [
      {
        card: play.card,
        actor: play.actor,
        def: play.def,
        commands: ids.map((targetId) => ({ type: "play" as const, cardId, targetId, autoEndTurn })),
      },
    ];
  });
}
