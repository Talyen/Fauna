import { species } from "./content";
import type { GameState } from "./types";
const MERCHANT_PRICE = 20;
export function merchantPrice(state: Pick<GameState, "boons">) {
  return MERCHANT_PRICE - (state.boons.includes("merchants-favor") ? 7 : 0);
}
export function campfireRecovery(creature: GameState["team"][number]) {
  const maximum = species(creature.species).health;
  return Math.min(maximum - creature.health, Math.round(maximum * 0.3));
}
export function needsCampfire(state: GameState) {
  return [...state.team, ...state.reserves].some((creature) => {
    const maximum = species(creature.species).health;
    return (maximum - creature.health) * 10 >= maximum * 3;
  });
}
export function canVisitCampfire(state: GameState) {
  return state.phase === "teamSelection" && state.expedition !== null && needsCampfire(state);
}
export function canVisitMerchant(state: GameState) {
  return (
    state.phase === "teamSelection" &&
    !!state.support &&
    !state.support.resolved &&
    state.support.stock.some((slot) => slot.price <= state.currency)
  );
}
