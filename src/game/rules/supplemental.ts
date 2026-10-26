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

const rules: SupplementalRules = freeze(
  {
    damage: {
      ordinaryAttackUtility: true,
      scaling: "power",
      enemy: true,
      keyword: "damageType",
      delivery: () => "global",
      describe: (effect, _card, label) =>
        `Deal ${effect.amount} ${label(effect.damageType)} damage${effect.leech ? " with Leech" : ""}`,
    },
    heal: {
      ordinaryAttackUtility: false,
      scaling: "power",
      enemy: true,
      keyword: "health",
      delivery: (effect) => (effect.target === "recipient" ? "recipient" : "global"),
      describe: (effect) =>
        `Restore ${effect.amount} Health${effect.target === "recipient" ? " to an injured ally" : ""}`,
    },
    cleanse: {
      ordinaryAttackUtility: false,
      scaling: "fixed",
      enemy: true,
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
      ordinaryAttackUtility: true,
      scaling: "fixed",
      enemy: true,
      keyword: "status",
      delivery: () => "global",
      describe: (effect, _card, label) => `Gain ${effect.amount} ${label(effect.status)}`,
    },
    drawKeyword: {
      ordinaryAttackUtility: false,
      scaling: "fixed",
      enemy: false,
      keyword: null,
      delivery: () => "global",
      describe: (effect, _card, label) => `Draw a ${label(effect.keyword)} card`,
    },
    draw: {
      ordinaryAttackUtility: true,
      scaling: "fixed",
      enemy: false,
      keyword: null,
      delivery: () => "global",
      describe: (effect, card) =>
        (card.effect === "swapLowest" || card.effect === "swapChosen") && effect.amount === 1
          ? "Draw a Card"
          : `Draw ${effect.amount} card${effect.amount === 1 ? "" : "s"}`,
    },
    mana: {
      ordinaryAttackUtility: true,
      scaling: "fixed",
      enemy: false,
      keyword: "mana",
      delivery: () => "global",
      describe: (effect) => `Gain ${effect.amount} Mana`,
    },
    nullifyFreeze: {
      ordinaryAttackUtility: false,
      scaling: "fixed",
      enemy: true,
      keyword: null,
      delivery: () => "global",
      describe: () => "Nullify the next Freeze damage",
    },
    blind: {
      ordinaryAttackUtility: true,
      scaling: "fixed",
      enemy: true,
      keyword: null,
      delivery: () => "global",
      describe: () => "Blind all enemies",
    },
    meltArmor: {
      ordinaryAttackUtility: true,
      scaling: "fixed",
      enemy: true,
      keyword: "purge",
      delivery: () => "global",
      describe: (effect) => `Remove ${effect.amount}% of all enemies’ Armor, rounded up`,
    },
    reflect: {
      ordinaryAttackUtility: false,
      scaling: "fixed",
      enemy: true,
      keyword: null,
      delivery: () => "global",
      describe: (effect) =>
        effect.status === "burn" ? "Reflect the next Burn" : "Reflect the next harmful status effect",
    },
    purge: {
      ordinaryAttackUtility: true,
      scaling: "fixed",
      enemy: true,
      keyword: "purge",
      delivery: () => "global",
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
