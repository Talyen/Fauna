import { talentRule } from "./rules/talents";
import { boonRule } from "./rules/boons";
import { cardActor } from "./card-actors";
import { primaryAbilityValue } from "./combat/ability-values";
import { definition, type CardDefinition, type PassiveTier } from "./content";
import { enemyCard } from "./card-rules";
import { creaturePassive, cardKeywords, hasTalent, passiveAmount } from "./progression";
import type { BattleState, Card, Creature, GameState } from "./types";

export function metronomeActorValid(state: BattleState): boolean {
  return (
    state.battle.metronomeActor === null ||
    (state.boons.includes("mercury-metronome") &&
      [...state.team, ...state.reserves].some((unit) => unit.id === state.battle.metronomeActor))
  );
}
export function manaCapacity(state: GameState): number {
  if (!state.battle) return 0;
  return state.battle.maxMana + (state.boons.includes("rainkeeper") ? boonRule("rainkeeper").overflow : 0);
}
export function encoreProgressLimit(state: Pick<GameState, "boons">): number {
  return state.boons.includes("encore-baton") ? boonRule("encore-baton").cards - 1 : 0;
}
export function puzzleProgressLimit(state: Pick<GameState, "boons">): number {
  return state.boons.includes("story-puzzle-cube") ? boonRule("story-puzzle-cube").effects - 1 : 0;
}
/** Intrinsic effect value; healing caps resolve in the command. */
export function actionValue(
  card: Card,
  actor: { species: Creature["species"] | null; attacked: boolean } & Partial<
    Pick<Creature, "block" | "combat">
  >,
  state?: Pick<GameState, "talents" | "boons" | "discovery">,
): number {
  const def = definition(card.definitionId);
  if (def.species === null)
    return (
      def.value * (state && state.boons.includes("nectar-dipper") ? boonRule("nectar-dipper").multiplier : 1)
    );
  return intrinsicAbilityValue(def, actor, card.level, creaturePassive(state, actor.species!));
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

export function passiveCardBonus(def: CardDefinition, passive: PassiveTier, attacked: boolean) {
  return passive.effects.reduce((total, effect) => {
    if (effect.kind !== "cardBonus") return total;
    const applies =
      effect.trigger === "firstAttack"
        ? def.effect === "attack" && !attacked
        : effect.trigger === "stunAttack"
          ? def.effect === "attack" && def.damageType === "stun"
          : effect.trigger === "heal"
            ? def.effect === "heal"
            : def.effect === "guard" || def.effect === "redistributeBlock" || def.effect === "teamProtection";
    return total + (applies ? effect.amount : 0);
  }, 0);
}
export function cardCost(
  card: Pick<Card, "definitionId"> & Partial<Pick<Card, "ownerId">>,
  state: GameState,
) {
  const actor = card.ownerId === undefined ? undefined : cardActor(state, { ownerId: card.ownerId });
  const def = definition(card.definitionId);
  if (def.species === null) return def.cost;
  if (actor?.combat?.[talentRule("stun.free-follow-up").state]) return 0;
  const freeNature = actor?.combat?.[talentRule("nature.windstep").state];
  const freeLight = actor?.combat?.[talentRule("light.divine-favor").state];
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
  const bonus = passiveAmount(state, unit.species, "blockRetention");
  return Math.round((unit.block * (100 + bonus)) / 200);
}
