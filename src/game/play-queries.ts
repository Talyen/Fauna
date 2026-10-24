import { cardActor, unfinishedJourneyLimit } from "./card-actors";
import { cardTargeting } from "./card-rules";
import { definition, species, type CardDefinition } from "./content";
import { cardCost } from "./ability-rules";
import { controlled } from "./combat/state";
import { battlefield } from "./battlefield";
import { pendingReplacement } from "./team";
import type { BattleState, Card, Creature, Command } from "./types";

/** Explicit recipients only; random/group delivery remains live execution work. */
export function chosenRecipients(state: BattleState, def: CardDefinition) {
  const mode = cardTargeting(def);
  return mode === "enemy" || mode === "ally"
    ? (def.effect === "resurrect"
        ? [...state.team, ...state.reserves]
        : battlefield(state, mode === "enemy" ? "enemy" : "player")
      ).filter((unit) => (def.effect === "resurrect" ? unit.health === 0 : unit.health > 0))
    : [];
}

export function playTargetError(state: BattleState, def: CardDefinition, actorId: string, targetId?: string) {
  const mode = cardTargeting(def);
  if (
    (mode === "enemy" || mode === "ally") &&
    !chosenRecipients(state, def).some((unit) => unit.id === targetId)
  )
    return def.effect === "resurrect"
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
  const card = state.cards.find((entry) => entry.id === cardId);
  if (!card || !state.battle.hand.includes(card.id))
    return { allowed: false, reason: "That card is not in your hand." };
  const actor = cardActor(state, card);
  if (!actor || actor.health <= 0) return { allowed: false, reason: "That creature is knocked out." };
  if (card.ownerId !== null && controlled(actor))
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
  const def = definition(card.definitionId);
  if (def.effect === "resurrect" && !chosenRecipients(state, def).length)
    return { allowed: false, reason: "There are no knocked-out allies." };
  if (state.battle.mana < cardCost(card, state)) return { allowed: false, reason: "Not enough Mana." };
  return { allowed: true, card, actor, def };
}

export interface AvailablePlay extends PlayableCard {
  commands: Extract<Command, { type: "play" }>[];
}

/** Enumerate legal commands without previewing, choosing random recipients or touching RNG. */
export function availablePlays(state: BattleState, autoEndTurn = true): AvailablePlay[] {
  if (pendingReplacement(state)) return [];
  return state.battle.hand.flatMap((cardId) => {
    const play = inspectCardPlay(state, cardId);
    if (!play.allowed) return [];
    const mode = cardTargeting(play.def);
    const ids =
      mode === "enemy" || mode === "ally"
        ? chosenRecipients(state, play.def).map((unit) => unit.id)
        : [undefined];
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
