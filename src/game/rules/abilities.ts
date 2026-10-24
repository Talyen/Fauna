import { freeze } from "immer";
import type { AbilityKind } from "./ability-types";
import type { AbilityRule, AbilityRuleCatalog } from "./contracts";
import { healingRules } from "./healing";
import { resourcesRules } from "./resources";
import { protectionRules } from "./protection";
import { utilityRules } from "./utility";
import { attackRules } from "./attack";

const rules: AbilityRuleCatalog = freeze(
  {
    ...healingRules,
    ...resourcesRules,
    ...protectionRules,
    ...utilityRules,
    ...attackRules,
  },
  true,
);

export function abilityRule<K extends AbilityKind>(kind: K): AbilityRule<K> {
  return rules[kind];
}
export function isAbilityKind(kind: string): kind is AbilityKind {
  return Object.hasOwn(rules, kind);
}
