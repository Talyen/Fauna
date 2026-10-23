import { primaryAbilityValue } from "./combat/ability-values";
import { definition, type CardDefinition, type PassiveTier } from "./content";
import { enemyCard } from "./card-rules";
import { creaturePassive, cardKeywords, hasTalent } from "./progression";
import type { Card, Creature, GameState } from "./types";
/** Intrinsic effect value; healing caps resolve in the command. */
export function actionValue(
  card: Card,
  actor: Pick<Creature, "species" | "attacked"> & Partial<Pick<Creature, "block" | "combat">>,
  state?: Pick<GameState, "talents" | "boons" | "discovery">,
): number {
  const def = definition(card.definitionId);
  return intrinsicAbilityValue(def, actor, card.level, creaturePassive(state, actor.species));
}
function intrinsicAbilityValue(
  def: CardDefinition,
  actor: { attacked?: boolean; combat?: Creature["combat"] },
  level: number,
  passive: PassiveTier,
  power = 1,
) {
  return (
    primaryAbilityValue(
      def,
      def.value + level * 2 + passiveCardBonus(def, passive, actor.attacked ?? false),
      power,
    ) * (def.effect === "attack" && def.doubleWithArmor && (actor.combat?.armor ?? 0) > 0 ? 2 : 1)
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
            : def.effect === "guard" ||
              def.effect === "teamGuard" ||
              def.effect === "redistributeBlock" ||
              def.effect === "teamProtection";
    return total + (applies ? effect.amount : 0);
  }, 0);
}
export function cardCost(
  card: Pick<Card, "definitionId"> & Partial<Pick<Card, "ownerId">>,
  state: GameState,
) {
  const actor = state.team.find((c) => c.id === ("ownerId" in card ? card.ownerId : undefined));
  const def = definition(card.definitionId);
  if (actor?.combat?.freeCard) return 0;
  const freeNature = actor?.combat?.freeNature;
  const freeLight = actor?.combat?.freeLight;
  const freeBurn = hasTalent(state, "burn.flashpoint") && !state.battle?.freeBurnUsed;
  if (freeNature || freeLight || freeBurn) {
    const keywords = cardKeywords(card);
    if (
      (freeNature && keywords.includes("nature")) ||
      (freeLight && keywords.includes("light")) ||
      (freeBurn && keywords.includes("burn"))
    )
      return 0;
  }
  return def.cost;
}
export function physicalBonus(actor: Pick<Creature, "block" | "combat">, state: Pick<GameState, "talents">) {
  return (
    (hasTalent(state, "physical.shield-slam") ? actor.block / 2 : 0) +
    (hasTalent(state, "physical.armored-fists") ? (actor.combat?.armor ?? 0) / 2 : 0)
  );
}

/** Same authored values and passive calculation; room power is an explicit magnitude modifier. */
export function enemyAbilityValue(
  enemy: Pick<import("./types").Enemy, "species" | "power"> &
    Partial<Pick<import("./types").Enemy, "combat">>,
  card: CardDefinition,
) {
  return intrinsicAbilityValue(card, enemy, 0, creaturePassive(undefined, enemy.species), enemy.power);
}

export function enemyInspectionValue(enemy: Parameters<typeof enemyAbilityValue>[0], card: CardDefinition) {
  return enemyAbilityValue(enemy, enemyCard(card));
}

/** Retention is a relative increase over the ordinary half-Block carryover. */
export function retainedBlock(
  unit: Pick<Creature, "species" | "block">,
  state?: Pick<GameState, "discovery">,
): number {
  const bonus = creaturePassive(state, unit.species).effects.reduce(
    (sum, effect) => sum + (effect.kind === "blockRetention" ? effect.amount : 0),
    0,
  );
  return Math.round((unit.block * (100 + bonus)) / 200);
}
