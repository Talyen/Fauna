import { enemyAbilityValue } from "../ability-rules";
import type { CardDefinition } from "../content/types";
import type { BattleState, Enemy, GameEvent } from "../types";
import { executeAbility } from "./abilities";
import { courtRemembers } from "./legendary";

/** Pay and execute the same enemy ability in live turns and policy probes. */
export function playEnemyAbility(
  state: BattleState,
  actor: Enemy,
  def: CardDefinition,
  targetId: string | undefined,
  allyTargetId: string | undefined,
  events: GameEvent[],
) {
  const deck = actor.deck;
  const cardIndex = deck?.hand.indexOf(def.id) ?? -1;
  const lastCardInHand = cardIndex >= 0 && deck?.hand.length === 1;
  if (deck) {
    deck.mana -= def.cost;
    if (cardIndex >= 0) {
      deck.hand.splice(cardIndex, 1);
      if (!def.consume) deck.discard.push(def.id);
    }
  }
  executeAbility(
    state,
    {
      side: "enemy",
      actor,
      def,
      value: enemyAbilityValue(actor, def),
      targetId,
      allyTargetId,
      lastCardInHand: deck ? lastCardInHand : undefined,
    },
    events,
  );
  if (deck) courtRemembers(state, actor, events);
  return lastCardInHand;
}
