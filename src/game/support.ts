import { species } from "./content";
import type { GameState } from "./types";
export const MERCHANT_PRICE = 20;
export const SPRING_CURRENCY = 10;
export const SPRING_HEAL_FRACTION = 0.15;
export function springRecovery(creature: GameState["team"][number]) {
  const maximum = species(creature.species).health;
  return Math.min(maximum - creature.health, Math.round(maximum * SPRING_HEAL_FRACTION));
}
export function supportTitle(kind: "merchant" | "spring") {
  return kind === "merchant" ? "Merchant" : "Sheltered Spring";
}
