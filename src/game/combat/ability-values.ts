import type { CardDefinition } from "../content";

/** Room power changes magnitudes, never chances, resource grants or effect counts. */
export const scalePower = (amount: number, power = 1) => Math.round(amount * power);
export function primaryAbilityValue(card: CardDefinition, value: number, power = 1): number {
  const kind = card.effect;
  switch (kind) {
    case "reflectAttack":
    case "resurrect":
    case "nightmareHarvest":
      return card.value;
    case "attack":
    case "heal":
    case "guard":
    case "teamGuard":
    case "redistributeBlock":
      return scalePower(value, power);
    // Mixed protection scales its Block branch only, after the shared coin flip.
    case "procession":
    case "createPearls":
    case "pearl":
    case "teamProtection":
    case "dreamDouble":
    case "waterThorns":
    case "recover":
    case "redraw":
    case "teamDodge":
    case "dodge":
    case "teamBlind":
    case "mana":
    case "teamClearBlind":
    case "swapLowest":
    case "teamThaw":
    case "teamPurge":
    case "teamCleanse":
    case "nullify":
    case "swap":
    case "draw":
      return value;
    default: {
      const unhandled: never = kind;
      throw new Error(`Unhandled ability value: ${unhandled}`);
    }
  }
}

const NO_EXTRAS: NonNullable<CardDefinition["effects"]> = Object.freeze([]);
/** Execution and descriptions share read-only extras; copy only amounts changed by scaling. */
export function abilityExtras(card: CardDefinition, power = 1): NonNullable<CardDefinition["effects"]> {
  const effects = card.effects ?? NO_EXTRAS;
  let scaled: (typeof effects)[number][] | undefined;
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index]!;
    const kind = effect.kind;
    switch (kind) {
      case "damage":
      case "heal": {
        const amount = scalePower(effect.amount, power);
        if (!Object.is(amount, effect.amount)) {
          scaled ??= effects.slice();
          scaled[index] = { ...effect, amount };
        }
        break;
      }
      case "status":
      case "nullifyFreeze":
      case "cleanse":
      case "reflect":
      case "drawKeyword":
      case "draw":
      case "mana":
      case "purge":
      case "blind":
      case "meltArmor":
        break;
      default: {
        const unhandled: never = kind;
        throw new Error(`Unhandled extra value: ${unhandled}`);
      }
    }
  }
  return scaled ?? effects;
}
