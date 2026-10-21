import { definition, type CardDefinition, type PassiveTier } from "./content";
import { creaturePassive, cardKeywords, hasTalent } from "./progression";
import type { Card, Creature, GameState } from "./types";
/** Intrinsic effect value; healing caps resolve in the command. */
export function actionValue(
  card: Card,
  actor: Pick<Creature, "species" | "attacked"> & Partial<Pick<Creature, "block" | "combat">>,
  state?: Pick<GameState, "talents" | "boons" | "discovery">,
): number {
  const def = definition(card.definitionId);
  return (
    def.value + card.level * 2 + passiveCardBonus(def, creaturePassive(state, actor.species), actor.attacked)
  );
}
function passiveCardBonus(def: CardDefinition, passive: PassiveTier, attacked: boolean) {
  return passive.effects.reduce((total, effect) => {
    if (effect.kind !== "cardBonus") return total;
    const applies =
      effect.trigger === "firstAttack"
        ? def.effect === "attack" && !attacked
        : effect.trigger === "stunAttack"
          ? def.effect === "attack" && def.damageType === "stun"
          : effect.trigger === "heal"
            ? def.effect === "heal"
            : def.effect === "guard" || def.effect === "teamGuard";
    return total + (applies ? effect.amount : 0);
  }, 0);
}
export function cardCost(
  card: Pick<Card, "definitionId"> & Partial<Pick<Card, "ownerId">>,
  state: GameState,
) {
  const actor = state.team.find((c) => c.id === ("ownerId" in card ? card.ownerId : undefined));
  const keywords = cardKeywords(card);
  if (
    actor?.combat?.freeCard ||
    (actor?.combat?.freeNature && keywords.includes("nature")) ||
    (actor?.combat?.freeLight && keywords.includes("light"))
  )
    return 0;
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
  return (
    (card.effect === "attack" ? enemy.damage : Math.max(1, Math.round(enemy.damage / 2))) +
    passiveCardBonus(card, creaturePassive(undefined, enemy.species), false)
  );
}

export function enemyInspectionValue(
  enemy: Pick<import("./types").Enemy, "species" | "damage"> &
    Partial<Pick<import("./types").Enemy, "combat">>,
  card: import("./content").CardDefinition,
) {
  return enemyAbilityValue(enemy, card);
}
