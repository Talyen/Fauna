import type { CardDefinition } from "../content";

/** Room power changes magnitudes, never chances, resource grants or effect counts. */
export const scalePower = (amount: number, power = 1) => Math.round(amount * power);
export function primaryAbilityValue(card: CardDefinition, value: number, power = 1): number {
  const kind = card.effect;
  switch (kind) {
    case "attack":
    case "heal":
    case "guard":
    case "teamGuard":
      return scalePower(value, power);
    // Mixed protection scales its Block branch only, after the shared coin flip.
    case "procession":
    case "createPearls":
    case "pearl":
    case "teamProtection":
    case "waterThorns":
    case "recover":
    case "teamDodge":
    case "dodge":
    case "teamBlind":
    case "mana":
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

/** Execution and descriptions use the same resolved supplemental amounts. */
export function abilityExtras(card: CardDefinition, power = 1) {
  return (
    card.effects?.map((effect) => {
      const kind = effect.kind;
      switch (kind) {
        case "damage":
        case "heal":
          return { ...effect, amount: scalePower(effect.amount, power) };
        case "status":
        case "nullifyFreeze":
        case "cleanse":
        case "reflect":
        case "draw":
        case "mana":
        case "purge":
        case "blind":
        case "meltArmor":
          return effect;
        default: {
          const unhandled: never = kind;
          throw new Error(`Unhandled extra value: ${unhandled}`);
        }
      }
    }) ?? []
  );
}
