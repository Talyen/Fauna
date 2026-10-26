import { freeze } from "immer";
import type { CardDefinition } from "../content/types";
import type { KeywordId, ProgressionKeyword } from "../keywords";
import type { SupplementalEffect, SupplementalKind } from "./ability-types";

type SupplementalRule<K extends SupplementalKind> = {
  scaling: "power" | "fixed";
  enemy: boolean;
  ordinaryAttackUtility: boolean;
  keyword: ProgressionKeyword | "damageType" | "status" | "cleanse" | "purge" | null;
  delivery: (effect: SupplementalEffect & { kind: K }) => "recipient" | "global";
  describe: (
    effect: SupplementalEffect & { kind: K },
    card: CardDefinition,
    label: (keyword: KeywordId) => string,
  ) => string;
};
type SupplementalRules = { [K in SupplementalKind]: SupplementalRule<K> };

// Extras are fixed, global effects unless their authored kind overrides a policy.
const global = {
  scaling: "fixed",
  enemy: true,
  ordinaryAttackUtility: false,
  keyword: null,
  delivery: () => "global",
} as const satisfies Omit<SupplementalRule<SupplementalKind>, "describe">;

const rules: SupplementalRules = freeze(
  {
    damage: {
      ...global,
      ordinaryAttackUtility: true,
      scaling: "power",
      keyword: "damageType",
      describe: (effect, _card, label) =>
        `Deal ${effect.amount} ${label(effect.damageType)} damage${effect.leech ? " with Leech" : ""}`,
    },
    heal: {
      ...global,
      scaling: "power",
      keyword: "health",
      delivery: (effect) => (effect.target === "recipient" ? "recipient" : "global"),
      describe: (effect) =>
        `Restore ${effect.amount} Health${effect.target === "recipient" ? " to an injured ally" : ""}`,
    },
    cleanse: {
      ...global,
      keyword: "cleanse",
      delivery: (effect) => (effect.target === "recipient" ? "recipient" : "global"),
      describe: (effect) =>
        effect.target === "allAllies"
          ? "Cleanse all allies"
          : effect.target === "recipient"
            ? "Cleanse the healed ally"
            : `Cleanse acting creature: remove ${effect.amount} effect${effect.amount === 1 ? "" : "s"}`,
    },
    status: {
      ...global,
      ordinaryAttackUtility: true,
      keyword: "status",
      describe: (effect, _card, label) => `Gain ${effect.amount} ${label(effect.status)}`,
    },
    drawKeyword: {
      ...global,
      enemy: false,
      describe: (effect, _card, label) => `Draw a ${label(effect.keyword)} card`,
    },
    draw: {
      ...global,
      ordinaryAttackUtility: true,
      enemy: false,
      describe: (effect, card) =>
        (card.effect === "swapLowest" || card.effect === "swapChosen") && effect.amount === 1
          ? "Draw a Card"
          : `Draw ${effect.amount} card${effect.amount === 1 ? "" : "s"}`,
    },
    mana: {
      ...global,
      ordinaryAttackUtility: true,
      enemy: false,
      keyword: "mana",
      describe: (effect) => `Gain ${effect.amount} Mana`,
    },
    nullifyFreeze: {
      ...global,
      describe: () => "Nullify the next Freeze damage",
    },
    blind: {
      ...global,
      ordinaryAttackUtility: true,
      describe: () => "Blind all enemies",
    },
    meltArmor: {
      ...global,
      ordinaryAttackUtility: true,
      keyword: "purge",
      describe: (effect) => `Remove ${effect.amount}% of all enemies’ Armor, rounded up`,
    },
    reflect: {
      ...global,
      describe: (effect) =>
        effect.status === "burn" ? "Reflect the next Burn" : "Reflect the next harmful status effect",
    },
    purge: {
      ...global,
      ordinaryAttackUtility: true,
      keyword: "purge",
      describe: (effect) => `Purge target: remove ${effect.amount} effect${effect.amount === 1 ? "" : "s"}`,
    },
  },
  true,
);

export function supplementalRule<K extends SupplementalKind>(kind: K): SupplementalRule<K> {
  return rules[kind];
}
export function isSupplementalKind(kind: string): kind is SupplementalKind {
  return Object.hasOwn(rules, kind);
}
