import type { AbilityRuleCatalog } from "./contracts";
import { scalePower } from "./contracts";

export const attackRules = {
  attack: {
    targeting: "attack",
    scaling: "power",
    enemy: "supported",
    adaptation: "extras",
    keywords: [],
    describe(card, { value, level, power, label }) {
      let text: string;
      // Keep the conditional rule at its base value so resolved previews do not imply a second doubling
      if (card.doubleWithArmor || card.doubleAgainstHealthier)
        value = scalePower(card.value + level * 2, power);
      text = `Deal ${value} ${label(card.damageType)}${card.alternateDamageType ? ` or ${label(card.alternateDamageType)}` : ""} damage${card.alternateDamageType ? " at random" : ""}${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}`;
      if (card.purgeThorns) text = `Purge enemy Thorns; ${text}`;
      if (card.doubleAgainstHealthier) text += " / Doubled against enemies with more Health than you";
      if (card.doubleWithArmor) text += "; Doubled if you have Armor";
      if (card.criticalWhenLastCard) text += " / If this is the last card in your hand, it Critically Hits";
      return text;
    },
  },
} satisfies Pick<AbilityRuleCatalog, "attack">;
