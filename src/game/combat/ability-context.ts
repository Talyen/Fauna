import { battlefield, livingBattlefield } from "../battlefield";
import type { CardDefinition } from "../content/types";
import type { Creature, Enemy, GameState, GameEvent, BattleState, CombatState } from "../types";
import type { Combatant } from "./state";

export type AbilityAction = {
  def: CardDefinition;
  value: number;
  targetId?: string;
  allyTargetId?: string;
  lastCardInHand?: boolean;
} & ({ side: "player"; actor: Creature } | { side: "enemy"; actor: Enemy });
export interface AbilityOperations {
  swap: (
    state: GameState,
    actor: Combatant,
    events: GameEvent[],
    backupOnly?: boolean,
    backupId?: string,
  ) => Combatant | undefined;
}
export const actorPower = (action: AbilityAction) => (action.side === "enemy" ? action.actor.power : 1);
export const friendlyRow = (state: GameState, action: AbilityAction): Combatant[] =>
  battlefield(state, action.side);
export const livingFriends = (state: GameState, action: AbilityAction): Combatant[] =>
  livingBattlefield(state, action.side);
export const livingOpponents = (state: GameState, action: AbilityAction): Combatant[] =>
  livingBattlefield(state, action.side === "player" ? "enemy" : "player");

export interface PrimaryContext {
  state: BattleState;
  action: AbilityAction;
  events: GameEvent[];
  operations: AbilityOperations;
  target: Combatant | undefined;
  name: string;
  stats: CombatState;
  keywords: readonly string[];
  blindMiss: boolean;
  cannotDodge: boolean;
  criticalBonus: number;
  oasisLeech: boolean;
  additionalTarget?: Combatant;
}
