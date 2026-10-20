import { definition } from "./content";
import { cardKeywords, hasTalent } from "./progression";
import type { Card, Creature, GameState } from "./types";
/** Intrinsic effect value; healing caps resolve in the command. */
export function actionValue(
  card: Card,
  actor: Pick<Creature, "species" | "attacked"> & Partial<Pick<Creature, "block" | "combat">>,
  _state?: Pick<GameState, "talents" | "boons">,
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
  return def.value + card.level * 2 + bonus;
}
export function cardCost(card: Pick<Card, "definitionId">, state: GameState) {
  return hasTalent(state, "burn.flashpoint") &&
    !state.battle?.freeBurnUsed &&
    cardKeywords(card).includes("burn")
    ? 0
    : definition(card.definitionId).cost;
}
export function physicalBonus(actor: Pick<Creature, "block" | "combat">, state: Pick<GameState, "talents">) {
  return (
    (hasTalent(state, "physical.shield-slam") ? actor.block / 2 : 0) +
    (hasTalent(state, "physical.armored-fists") ? (actor.combat?.armor ?? 0) / 2 : 0)
  );
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
  return enemyAbilityValue(enemy, card);
}
