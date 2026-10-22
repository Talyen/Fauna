import type { KeywordId } from "./keywords";
import type { SpeciesId, DamageType, BoonId } from "./content";
import type { Keyword } from "./progression";

export interface CombatState {
  controlTurns: number;
  rhythm: number;
  nextPhysical: number;
  partingCut: boolean;
  riposte: boolean;
  freeNature: boolean;
  freeLight: boolean;
  freeCard: boolean;
  reflect: boolean;
  reflectBurn: boolean;
  nullify: boolean;
  nullifyFreeze: boolean;
  cardsPlayedThisTurn: number;
  encoreUsed: boolean;
  firstAttackUsed: boolean;
  desperateGuardUsed: boolean;
  armor: number;
  thorns: number;
  waterThorns: number;
  dodge: number;
  temporaryDodge: number;
  blind: boolean;
  burn: number;
  poison: number;
  bleed: number;
  stun: number;
  freeze: number;
  controlled: "stun" | "freeze" | null;
  cooldown: number;
  skipped: boolean;
  deathDoorUsed: boolean;
  grace: number;
  statusSources: Partial<Record<"burn" | "poison" | "bleed", string>>;
  bleedLeech: { sourceId: string; amount: number }[];
}
export interface Creature {
  id: string;
  species: SpeciesId;
  health: number;
  block: number;
  attacked: boolean;
  combat?: CombatState;
}
export interface Card {
  id: string;
  definitionId: string;
  ownerId: string;
  level: number;
  temporary?: true;
}
export interface Enemy {
  id: string;
  name: string;
  species: SpeciesId;
  health: number;
  maxHealth: number;
  power: number;
  targetId: string;
  block: number;
  combat: CombatState;
  lastAbility: string | null;
}
/** Runtime and persisted phase payloads share one structural contract. */
export type GameState = import("zod").infer<typeof import("./state-schema").gameStateSchema>;
export type StateAt<P extends GameState["phase"]> = Extract<GameState, { phase: P }>;
export type BattleState = StateAt<"battle">;
export type RewardState = StateAt<"recruit" | "boon">;
export type Lifecycle = GameState extends infer S
  ? S extends GameState
    ? Pick<S, "phase" | "battle" | "reward" | "journey" | "support" | "expedition">
    : never
  : never;

export type Command =
  | { type: "draft"; species: SpeciesId }
  | { type: "start" }
  | { type: "beginBattle" }
  | { type: "setLineup"; activeId: string; reserve: string }
  | { type: "swap"; activeId: string; reserve: string }
  | { type: "play"; cardId: string; targetId?: string; autoEndTurn?: boolean }
  | { type: "endTurn" }
  | { type: "devWinBattle" }
  | { type: "visitCampfire" }
  | { type: "rest" }
  | { type: "leaveCampfire" }
  | { type: "enterSupport"; visit: string }
  | { type: "buyBoon"; visit: string; slot: string }
  | { type: "leaveSupport"; visit: string }
  | { type: "recruit"; species: SpeciesId; replace?: string }
  | { type: "recruitDestination"; species: SpeciesId }
  | { type: "skipRecruit" }
  | { type: "chooseBoon"; boon: BoonId }
  | { type: "skipBoon" }
  | { type: "buyTalent"; talentId: string }
  | { type: "resetTalents"; keyword: Keyword }
  | { type: "newRun"; seed: number }
  | { type: "abandon" };
export interface GameEvent {
  actionType?: "attack" | "support" | "swap";
  kind: "action" | "damage" | "block" | "heal" | "knockout" | "turn" | "reward" | "victory" | "status";
  text: string;
  actorId?: string;
  targetId?: string;
  amount?: number;
  damageType?: DamageType;
  critical?: boolean;
  periodic?: boolean;
  additive?: boolean;
  impact?: boolean;
  status?: KeywordId | "deathDoor";
  outcome?: "gain" | "remove" | "apply" | "immune" | "dodge" | "skip";
  affectedStatus?: KeywordId;
}
export type CommandResult =
  | { accepted: true; state: GameState; events: GameEvent[] }
  | { accepted: false; state: GameState; reason: string; events: [] };
