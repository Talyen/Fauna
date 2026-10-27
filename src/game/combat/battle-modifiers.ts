import { talentRule } from "../rules/talents";
import { boonRule } from "../rules/boons";
import { healingAllies } from "../battlefield";
import { creaturePassive, hasTalent, cardHasKeyword } from "../progression";
import { draw, drawKeyword, expressDelivery } from "../card-zones";
import { grantArmor, grantStatus, grantBlock, restoreHealth, TURN_MANA, TURN_DRAW } from "./index";
import type { BattleState, Enemy, Creature, GameState, GameEvent } from "../types";

export function battleMana(state: Pick<GameState, "talents" | "boons" | "cards">) {
  return (
    TURN_MANA +
    Number(hasTalent(state, "mana.leyline-attunement")) * talentRule("mana.leyline-attunement").amount +
    (state.boons.includes("raincatcher-bowl") && state.cards.some((card) => cardHasKeyword(card, "water"))
      ? boonRule("raincatcher-bowl").mana
      : 0)
  );
}
export function enemyBattleStart(enemy: Enemy) {
  for (const effect of creaturePassive(undefined, enemy.species).effects) {
    if (effect.kind !== "battleStart") continue;
    if (effect.effect === "block") enemy.block += effect.amount;
    else enemy.combat[effect.effect] += effect.amount;
  }
}

/** Draws precede allied grants, retaining their existing chance and reaction order. */
export function playerBattleStart(state: BattleState, events: GameEvent[]) {
  draw(
    state,
    TURN_DRAW + (state.boons.includes("tattered-pages") ? boonRule("tattered-pages").draw : 0),
    events,
  );
  expressDelivery(state, events);
  if (hasTalent(state, "nature.ecosystem")) drawKeyword(state, "nature", events);
  for (const unit of state.team) {
    if (hasTalent(state, "armor.bulwark"))
      grantArmor(state, unit, talentRule("armor.bulwark").amount, events);
    for (const effect of creaturePassive(state, unit.species).effects) {
      if (effect.kind !== "battleStart") continue;
      if (effect.effect === "block") grantBlock(state, unit, effect.amount, events);
      else if (effect.effect === "armor") grantArmor(state, unit, effect.amount, events);
      else grantStatus(unit, "thorns", effect.amount, events, state);
    }
    if (hasTalent(state, "mana.mana-bulwark")) grantBlock(state, unit, state.battle.maxMana, events);
    if (hasTalent(state, "mana.mana-shell")) grantArmor(state, unit, state.battle.maxMana, events);
    if (hasTalent(state, "health.combat-surge"))
      restoreHealth(unit, talentRule("health.combat-surge").amount, events, false, state);
  }
  if (hasTalent(state, "health.combat-surge"))
    for (const unit of healingAllies(state))
      if (state.reserves.some((backup) => backup.id === unit.id))
        restoreHealth(unit, talentRule("health.combat-surge").amount, events, false, state);
}
export function victoryRecovery(state: GameState, creature: Creature, events: GameEvent[]) {
  if (hasTalent(state, "health.vitality"))
    restoreHealth(creature, talentRule("health.vitality").amount, events, false, state);
}
export function victoryGoldBonus(state: Pick<GameState, "boons">) {
  return state.boons.includes("smugglers-map") ? boonRule("smugglers-map").gold : 0;
}

/** Captured before enemy actions, while the outgoing turn still owns its Mana. */
export function renewalManaBonus(state: BattleState) {
  return state.battle.mana > 0
    ? Number(hasTalent(state, "mana.wellspring")) * talentRule("mana.wellspring").amount
    : Number(hasTalent(state, "mana.dark-recovery")) * talentRule("mana.dark-recovery").amount;
}
