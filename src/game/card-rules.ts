import { abilityRule } from "./rules/abilities";
import { supplementalRule } from "./rules/supplemental";
import { abilityExtras, primaryAbilityValue } from "./combat/ability-values";
import { DAMAGE_TYPES, keywordLabel } from "./keywords";
import type { CardDefinition, DamageType } from "./content/types";
export const DAMAGE_LABELS = Object.fromEntries(DAMAGE_TYPES.map((id) => [id, keywordLabel(id)])) as Record<
  DamageType,
  string
>;
export function cardTargeting(card: CardDefinition): "enemy" | "ally" | "self" | "automatic" {
  const policy = abilityRule(card.effect).targeting;
  switch (policy) {
    case "attack":
      return card.target ? "automatic" : "enemy";
    case "guard":
    case "heal":
      return card.target === "self" ? "self" : card.target ? "automatic" : "ally";
    case "recover":
      return card.target === "ally" ? "ally" : "automatic";
    case "self":
      return card.target === "allAllies" ? "automatic" : "self";
    case "ally":
    case "automatic":
      return policy;
    default: {
      const unhandled: never = policy;
      throw new Error(`Unhandled targeting: ${unhandled}`);
    }
  }
}

export function enemyCard(card: CardDefinition): CardDefinition {
  if (abilityRule(card.effect).adaptation === "healingExtra") {
    const healing = card.effects?.find((effect) => effect.kind === "heal");
    if (healing)
      return {
        ...card,
        effect: "heal",
        target: healing.target === "recipient" ? undefined : "self",
        value: healing.amount,
        effects: [],
      };
  }
  return { ...card, effects: card.effects?.filter((effect) => supplementalRule(effect.kind).enemy) };
}

export function enemyCanUse(card: CardDefinition): boolean {
  const rule = abilityRule(card.effect);
  if (rule.adaptation === "healingExtra" && card.effects?.some((effect) => effect.kind === "heal"))
    return true;
  const policy = rule.enemy;
  switch (policy) {
    case "supported":
      return true;
    case "unsupported":
      return false;
    case "legendaryDraw":
      return card.species === "memento";
    default: {
      const unhandled: never = policy;
      throw new Error(`Unhandled enemy policy: ${unhandled}`);
    }
  }
}
export function cardText(
  card: CardDefinition,
  level = 0,
  value: number | undefined = undefined,
  power = 1,
): string {
  value ??= primaryAbilityValue(card, card.value + level * 2, power);
  let text = abilityRule(card.effect).describe(card, { value, level, power, label: keywordLabel });
  for (const effect of abilityExtras(card, power)) {
    text +=
      (card.effect === "teamClearBlind" ||
      card.effect === "swapLowest" ||
      (card.effect === "swap" && card.backupOnly) ||
      (card.effect === "heal" && card.target === "self" && effect.kind === "mana") ||
      (card.effect === "mana" && card.restore)
        ? " / "
        : "; ") + supplementalRule(effect.kind).describe(effect, card, keywordLabel);
  }
  if (card.leech) text += "; Leech";
  if (card.repeatChance) text += `; ${card.repeatChance}% chance to repeat`;
  if (card.species === null) {
    if (card.effect === "heal") text = `Restore ${value} Health`;
    if (card.effect === "guard") text = `Gain ${value} Block`;
    if (card.consume) text += "; Consume";
  } else if (card.consume) text = `Consume; ${text}`;
  return text;
}
