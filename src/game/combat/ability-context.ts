import { battlefield } from "../battlefield";
import type { CardDefinition } from "../content/types";
import type { Creature, Enemy, GameState, GameEvent, BattleState, CombatState } from "../types";
import type { Combatant } from "./state";
import type { AbilityKind } from "../rules/ability-types";
import type { AbilityCard } from "../rules/contracts";

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
export const opposingRow = (state: GameState, action: AbilityAction): Combatant[] =>
  battlefield(state, action.side === "player" ? "enemy" : "player");
export const alive = (row: Combatant[]) => row.filter((unit) => unit.health > 0);

export interface PrimaryContext<K extends AbilityKind = AbilityKind> {
  state: BattleState;
  action: AbilityAction;
  actor: Combatant;
  def: AbilityCard<K>;
  value: number;
  events: GameEvent[];
  operations: AbilityOperations;
  enemy: boolean;
  power: number;
  target: Combatant | undefined;
  attackTarget: Combatant | undefined;
  name: string;
  stats: CombatState;
  keywords: readonly string[];
  blindMiss: boolean;
  criticalBonus: number;
  negated: Set<string>;
}
export type PrimaryHandler<K extends AbilityKind> = (context: PrimaryContext<K>) => void;
export type PrimaryHandlers = { [K in AbilityKind]: PrimaryHandler<K> };
