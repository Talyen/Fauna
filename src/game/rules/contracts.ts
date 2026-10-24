import type { CardDefinition } from "../content/types";
import type { KeywordId, ProgressionKeyword } from "../keywords";
import type { AbilityKind } from "./ability-types";

export type AbilityCard<K extends AbilityKind = AbilityKind> = CardDefinition & { effect: K };
export interface DescriptionContext {
  value: number;
  level: number;
  power: number;
  label: (keyword: KeywordId) => string;
}
export interface AbilityRule<K extends AbilityKind = AbilityKind> {
  targeting: "attack" | "guard" | "heal" | "recover" | "self" | "ally" | "automatic";
  scaling: "authored" | "power" | "level";
  enemy: "supported" | "unsupported" | "legendaryDraw";
  adaptation: "extras" | "healingExtra";
  keywords: readonly ProgressionKeyword[];
  describe: (card: AbilityCard<K>, context: DescriptionContext) => string;
}
export type AbilityRuleCatalog = { [K in AbilityKind]: AbilityRule<K> };

/** Room power changes magnitudes, never chances, resource grants or effect counts. */
export const scalePower = (amount: number, power = 1) => Math.round(amount * power);
