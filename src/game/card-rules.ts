import { abilityExtras, primaryAbilityValue, scalePower } from "./combat/ability-values";
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
    effects: card.effects?.filter((effect) => {
      const kind = effect.kind;
      switch (kind) {
        case "damage":
        case "status":
        case "cleanse":
        case "purge":
        case "reflect":
        case "heal":
        case "blind":
        case "meltArmor":
        case "nullifyFreeze":
          return true;
        case "drawKeyword":
        case "draw":
        case "mana":
          return false;
        default: {
          const unhandled: never = kind;
          throw new Error(`Unhandled enemy extra: ${unhandled}`);
        }
      }
    }),
  };
}
/** Enemies have no shared hand, Mana pool or discard pile. Decide support for every primary kind. */
export function enemyCanUse(card: CardDefinition): boolean {
  const effect =
    card.effect === "draw" && card.effects?.some((effect) => effect.kind === "heal") ? "heal" : card.effect;
  switch (effect) {
    case "createPearls":
    case "pearl":
    case "procession":
      return true;
    case "draw":
      return card.species === "memento";
    case "mana":
    case "recover":
    case "redraw":
    case "swapLowest":
      return false;
    case "attack":
    case "guard":
    case "heal":
    case "waterThorns":
    case "teamDodge":
    case "dodge":
    case "teamBlind":
    case "teamClearBlind":
    case "teamThaw":
    case "teamPurge":
    case "teamCleanse":
    case "nullify":
    case "swap":
    case "teamGuard":
    case "redistributeBlock":
    case "teamProtection":
      return true;
    default: {
      const unhandled: never = effect;
      throw new Error(`Unhandled enemy ability: ${unhandled}`);
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
  let text: string;
  switch (card.effect) {
    case "procession":
      text = "Summon an Echo / Restore your Minions to full Health";
      break;
    case "createPearls":
      text = `Create ${value} Pearls`;
      break;
    case "pearl":
      text = `Gain ${scalePower(value, power)} Block or ${value} Mana at random`;
      break;
    case "attack":
      // Keep the conditional rule at its base value so resolved previews do not imply a second doubling
      if (card.doubleWithArmor || card.doubleAgainstHealthier)
        value = primaryAbilityValue(card, card.value + level * 2, power);
      text = `Deal ${value} ${DAMAGE_LABELS[card.damageType]}${card.alternateDamageType ? ` or ${DAMAGE_LABELS[card.alternateDamageType]}` : ""} damage${card.alternateDamageType ? " at random" : ""}${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}`;
      if (card.purgeThorns) text = `Purge enemy Thorns; ${text}`;
      if (card.doubleAgainstHealthier) text += " / Doubled against enemies with more Health than you";
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
      text = "Return a random discarded card from a living ally to your hand";
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
    case "teamClearBlind":
      text = "Cleanse allies Blind";
      break;
    case "swapLowest":
      text = "Swap out the lowest Health ally";
      break;
    case "teamThaw":
      text = "Cleanse all Freeze build-up from allies";
      break;
    case "teamPurge":
      text = "Purge all enemies";
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
    case "redraw":
      text = "Shuffle your hand into your deck; Draw that many cards";
      break;
    case "redistributeBlock":
      text = `Redistribute allied Block evenly; Allies gain ${value} Block`;
      break;
    case "teamGuard":
      text = `Allies gain ${value} Block`;
      break;
    case "teamProtection":
      text =
        power === 1
          ? `Grant all allies ${value} Block or Thorns`
          : `Grant all allies ${scalePower(value, power)} Block or ${value} Thorns`;
      break;
  }
  for (const effect of abilityExtras(card, power)) {
    text +=
      (card.effect === "teamClearBlind" || card.effect === "swapLowest" ? " / " : "; ") +
      (effect.kind === "nullifyFreeze"
        ? "Nullify the next Freeze damage"
        : effect.kind === "damage"
          ? `Deal ${effect.amount} ${DAMAGE_LABELS[effect.damageType]} damage${effect.leech ? " with Leech" : ""}`
          : effect.kind === "status"
            ? `Gain ${effect.amount} ${keywordLabel(effect.status)}`
            : effect.kind === "drawKeyword"
              ? `Draw a ${keywordLabel(effect.keyword)} card`
              : effect.kind === "draw"
                ? card.effect === "swapLowest" && effect.amount === 1
                  ? "Draw a Card"
                  : `Draw ${effect.amount} card${effect.amount === 1 ? "" : "s"}`
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
  if (card.consume) text = `Consume; ${text}`;
  return text;
}
