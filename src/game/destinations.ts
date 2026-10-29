import { boonRule } from "./rules/boons";
import { bossEncounter } from "./encounters";
import { species } from "./content";
import type { GameState } from "./types";
export function merchantPriceRange(state: Pick<GameState, "boons">) {
  const discount = state.boons.includes("merchants-favor") ? boonRule("merchants-favor").discount : 0;
  return { min: 20 - discount, max: 40 - discount };
}
export function merchantOfferCount(state: Pick<GameState, "boons">) {
  return 3 + (state.boons.includes("bargain-scales") ? boonRule("bargain-scales").offers : 0);
}
const CAMPFIRE_RECOVERY_PERCENT = 30;

export function campfireRecovery(creature: GameState["team"][number]) {
  const maximum = species(creature.species).health;
  return Math.min(maximum - creature.health, Math.round(maximum * (CAMPFIRE_RECOVERY_PERCENT / 100)));
}
export function needsCampfire(state: GameState) {
  const needsRecovery = (creature: GameState["team"][number]) => {
    const maximum = species(creature.species).health;
    return (maximum - creature.health) * 100 >= maximum * CAMPFIRE_RECOVERY_PERCENT;
  };
  return state.team.some(needsRecovery) || state.reserves.some(needsRecovery);
}
export function canVisitCampfire(state: GameState) {
  return (
    state.phase === "teamSelection" &&
    !bossEncounter(state) &&
    state.expedition !== null &&
    state.expedition.lastRoom !== "campfire" &&
    needsCampfire(state)
  );
}
export function canVisitMerchant(state: GameState) {
  return (
    state.phase === "teamSelection" &&
    !bossEncounter(state) &&
    state.expedition.lastRoom !== "merchant" &&
    !!state.support &&
    !state.support.resolved &&
    state.support.stock.some((slot) => slot.price <= state.currency)
  );
}

export function canRecruitDestination(state: GameState) {
  return (
    state.phase === "teamSelection" &&
    !bossEncounter(state) &&
    state.expedition.lastRoom !== "recruit" &&
    state.team.length + state.reserves.length < 5 &&
    !!state.expedition.recruit &&
    !species(state.expedition.recruit).legendary
  );
}
