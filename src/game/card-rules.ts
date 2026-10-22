import { DAMAGE_TYPES, keywordLabel } from "./keywords";
import type { CardDefinition, DamageType } from "./content/types";
export const DAMAGE_LABELS = Object.fromEntries(DAMAGE_TYPES.map((id) => [id, keywordLabel(id)])) as Record<
  DamageType,
  string
>;
export function enemyCard(card: CardDefinition): CardDefinition {
  // Enemies have no hand; retain the self-healing half of a draw ability
  if (card.effect === "draw") {
    const healing = card.effects?.find((effect) => effect.kind === "heal");
    if (healing) return { ...card, effect: "heal", target: "self", value: healing.amount, effects: [] };
  }
  return {
    ...card,
    effects: card.effects?.filter((effect) =>
      [
        "damage",
        "status",
        "cleanse",
        "purge",
        "reflect",
        "heal",
        "blind",
        "meltArmor",
        "nullifyFreeze",
      ].includes(effect.kind),
    ),
  };
}
export function cardText(card: CardDefinition, level = 0, value = card.value + level * 2): string {
  let text: string;
  switch (card.effect) {
    case "attack":
      // Keep the conditional rule at its base value so resolved previews do not imply a second doubling
      if (card.doubleWithArmor) value = card.value + level * 2;
      text = `Deal ${value} ${DAMAGE_LABELS[card.damageType]}${card.alternateDamageType ? ` or ${DAMAGE_LABELS[card.alternateDamageType]}` : ""} damage${card.alternateDamageType ? " at random" : ""}${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}`;
      if (card.doubleWithArmor) text += "; Doubled if you have Armor";
      break;
    case "guard":
      text = card.target === "self" ? `Gain ${value} Block` : `Give an ally ${value} Block`;
      break;
    case "heal":
      text =
        card.target === "self"
          ? `Restore ${value} Health`
          : `Restore ${value} Health to ${card.target === "allAllies" ? "all allies" : card.target === "mostInjured" ? "the most injured ally" : "a living ally"}`;
      break;
    case "waterThorns":
      text = `Gain ${value} Water Thorns`;
      break;
    case "recover":
      text = "Return a random discarded card to your hand";
      break;
    case "teamDodge":
      text = `Give all allies ${value}% Dodge until your next turn`;
      break;
    case "dodge":
      text = `Gain ${value}% Dodge until your next turn`;
      break;
    case "teamBlind":
      text = "Blind all enemies";
      break;
    case "mana":
      text = `Gain ${value} Mana`;
      break;
    case "teamThaw":
      text = "Cleanse all Freeze build-up from allies";
      break;
    case "teamCleanse":
      text = `Cleanse ${value} harmful effect${value === 1 ? "" : "s"} from all allies`;
      break;
    case "nullify":
      text = "Nullify the next harmful status effect on each ally";
      break;
    case "swap":
      text = "Swap out for a random backup";
      break;
    case "draw":
      text = `Draw ${value} card${value === 1 ? "" : "s"}`;
      break;
    case "teamGuard":
      text = `Allies gain ${value} Block`;
      break;
    case "teamProtection":
      text = `Grant all allies ${value} Block or Thorns`;
      break;
  }
  for (const effect of card.effects ?? []) {
    text +=
      "; " +
      (effect.kind === "nullifyFreeze"
        ? "Nullify the next Freeze damage"
        : effect.kind === "damage"
          ? `Deal ${effect.amount} ${DAMAGE_LABELS[effect.damageType]} damage${effect.leech ? " with Leech" : ""}`
          : effect.kind === "status"
            ? `Gain ${effect.amount} ${keywordLabel(effect.status)}`
            : effect.kind === "draw"
              ? `Draw ${effect.amount} card${effect.amount === 1 ? "" : "s"}`
              : effect.kind === "mana"
                ? `Gain ${effect.amount} Mana`
                : effect.kind === "heal"
                  ? `Restore ${effect.amount} Health`
                  : effect.kind === "blind"
                    ? "Blind all enemies"
                    : effect.kind === "meltArmor"
                      ? `Remove ${effect.amount}% of all enemies’ Armor, rounded up`
                      : effect.kind === "reflect"
                        ? effect.status === "burn"
                          ? "Reflect the next Burn"
                          : "Reflect the next harmful status effect"
                        : effect.kind === "cleanse" && effect.target === "allAllies"
                          ? "Cleanse all allies"
                          : effect.kind === "cleanse" && effect.target === "recipient"
                            ? "Cleanse the healed ally"
                            : `${effect.kind === "cleanse" ? "Cleanse acting creature" : "Purge target"}: remove ${effect.amount} effect${effect.amount === 1 ? "" : "s"}`);
  }
  if (card.leech) text += "; Leech";
  if (card.repeatChance) text += `; ${card.repeatChance}% chance to repeat`;
  return text;
}
