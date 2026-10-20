import { definition } from "./content";
import { cardKeywords, hasTalent } from "./progression";
import type { Card, Creature, GameState } from "./types";
/** Intrinsic effect value; healing caps resolve in the command. */
export function actionValue(
  card: Card,
  actor: Pick<Creature, "species" | "attacked"> & Partial<Pick<Creature, "block" | "combat">>,
  state?: Pick<GameState, "talents" | "relics">,
): number {
  const def = definition(card.definitionId);
  const bonus =
    def.effect === "attack" && actor.species === "emberfox" && !actor.attacked
      ? 2
      : def.effect === "attack" && def.damageType === "lightning" && actor.species === "stormfin"
        ? 1
        : def.effect === "heal" && actor.species === "silkmoth"
          ? 2
          : (def.effect === "guard" || def.effect === "teamGuard") && actor.species === "mossback"
            ? 2
            : 0;
  let extra = 0;
  if (state) {
    for (const keyword of cardKeywords(card)) {
      if (hasTalent(state, keyword, "potency")) extra++;
      if (hasTalent(state, keyword, "mastery")) extra++;
      if (hasTalent(state, keyword, "focus") && (actor.block ?? 0) > 0) extra += 2;
    }
    if (def.effect === "attack" && def.damageType === "fire" && state.relics.includes("emberstone")) extra++;
    if (def.effect === "heal" && state.relics.includes("living-seed")) extra += 2;
  }
  return def.value + card.level * 2 + bonus + extra;
}

/** Additional final effects from accepted card plays; previews and details share this calculation. */
export function cardFollowups(card: Pick<Card, "definitionId">, state: Pick<GameState, "talents">) {
  let block = 0,
    heal = 0;
  for (const keyword of cardKeywords(card)) {
    if (hasTalent(state, keyword, "shelter")) block += 2;
    if (hasTalent(state, keyword, "renewal")) heal++;
  }
  return { block, heal };
}

/** Enemy repertoire uses encounter magnitudes and its own native trait, never player progression. */
export function enemyAbilityValue(
  enemy: Pick<import("./types").Enemy, "species" | "damage">,
  card: import("./content").CardDefinition,
) {
  if (card.effect === "attack")
    return (
      enemy.damage +
      (enemy.species === "emberfox"
        ? 2
        : enemy.species === "stormfin" && card.damageType === "lightning"
          ? 1
          : 0)
    );
  return (
    Math.max(1, Math.round(enemy.damage / 2)) +
    (card.effect === "heal" ? (enemy.species === "silkmoth" ? 2 : 0) : enemy.species === "mossback" ? 2 : 0)
  );
}

export function enemyInspectionValue(
  enemy: Pick<import("./types").Enemy, "species" | "damage"> &
    Partial<Pick<import("./types").Enemy, "combat">>,
  card: import("./content").CardDefinition,
) {
  return (
    enemyAbilityValue(enemy, card) +
    (card.effect === "attack" && (card.damageType === "physical" || card.damageType === "stun")
      ? (enemy.combat?.forge ?? 0)
      : 0)
  );
}
