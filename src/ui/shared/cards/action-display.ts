import { actionValue, physicalBonus } from "../../../game/ability-rules";
import { definition } from "../../../game/content";
import { enemyCard } from "../../../game/card-rules";
import type { Card, Creature, GameState } from "../../../game/types";

/** Resolve the same rules for artwork labels, tooltips, and target selection. */
export function actionDisplay(
  card: Card,
  actor: Creature | undefined,
  modifiers: GameState | undefined,
  enemy: boolean,
  enemyValue: number | undefined,
) {
  const authored = definition(card.definitionId);
  const def = enemy ? enemyCard(authored) : authored;
  const value =
    enemyValue ??
    Math.round(
      actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers) +
        (modifiers && actor && def.effect === "attack" && def.damageType === "physical"
          ? physicalBonus(actor, modifiers)
          : 0),
    );
  return { def, value };
}
