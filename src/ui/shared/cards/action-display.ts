import { actionValue, physicalBonus } from "../../../game/ability-rules";
import { definition } from "../../../game/content";
import type { Card, Creature, GameState } from "../../../game/types";

/** Resolve the same rules for artwork labels, tooltips, and target selection. */
export function actionDisplay(card: Card, actor: Creature | undefined, modifiers: GameState | undefined) {
  const def = definition(card.definitionId);
  const value = Math.round(
    actionValue(card, actor ?? { species: def.species, attacked: false }, modifiers) +
      (modifiers && actor && def.effect === "attack" && def.damageType === "physical"
        ? physicalBonus(actor, modifiers)
        : 0),
  );
  return { def, value };
}
