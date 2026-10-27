import type { KeywordId } from "./keywords";
import type { SpeciesId, DamageType, BoonId } from "./content";
import type { Keyword } from "./progression";

export type CombatState = NonNullable<GameState["team"][number]["combat"]>;
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
  ownerId: string | null;
  level: number;
  temporary?: true;
}
export interface EnemyDeck {
  draw: string[];
  hand: string[];
  buffer: string[];
  discard: string[];
  mana: number;
  pearls: number;
}
export interface Enemy {
  minion?: { ownerId: string; side: "player" | "enemy" };
  deck?: EnemyDeck;
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
  | { type: "swap"; activeId: string; reserve: string; autoEndTurn?: boolean }
  | { type: "play"; cardId: string; targetId?: string; autoEndTurn?: boolean }
  | { type: "endTurn" }
  | { type: "devWinBattle" }
  | { type: "visitCampfire" }
  | { type: "rest" }
  | { type: "leaveCampfire" }
  | { type: "enterSupport"; visit: string }
  | { type: "buyBoon"; visit: string; slot: string }
  | { type: "leaveSupport"; visit: string }
  | { type: "recruit"; species: SpeciesId }
  | { type: "confirmRecruit"; replace?: string }
  | { type: "recruitDestination"; species: SpeciesId }
  | { type: "chooseBoon"; boon: BoonId }
  | { type: "skipBoon" }
  | { type: "buyTalent"; talentId: string }
  | { type: "resetTalents"; keyword: Keyword }
  | { type: "newRun"; seed: number }
  | { type: "abandon" };
interface EventContext {
  text: string;
  actorId?: string;
  targetId?: string;
}
export type DamageEvent = EventContext & {
  kind: "damage";
  targetId: string;
  amount: number;
  damageType: DamageType;
  critical?: boolean;
  periodic?: boolean;
  additive?: boolean;
  impact?: boolean;
};
export type StatusEvent = EventContext & {
  kind: "status";
  targetId: string;
  status: KeywordId | "deathDoor";
  outcome: "gain" | "remove" | "apply" | "immune" | "dodge" | "skip";
  amount?: number;
  affectedStatus?: KeywordId;
  additive?: boolean;
};
/** Committed facts: numeric combat payloads are complete; announcements carry no invented combat data. */
export type GameEvent =
  | DamageEvent
  | {
      [K in "heal" | "block"]: EventContext & {
        kind: K;
        targetId: string;
        amount: number;
        additive?: boolean;
      };
    }["heal" | "block"]
  | StatusEvent
  | (EventContext & {
      kind: "action";
      actorId: string;
      actionType: "attack" | "support" | "swap";
      amount?: number;
      announcement?: { kind: "useAbility"; definitionId: string };
    })
  | { [K in "turn" | "reward" | "victory" | "knockout"]: EventContext & { kind: K; amount?: number } }[
      "turn" | "reward" | "victory" | "knockout"]
  | (EventContext & {
      kind: "status";
      amount: number;
      targetId?: undefined;
      status?: undefined;
      outcome?: undefined;
      affectedStatus?: undefined;
    });
export type CommandResult =
  | { accepted: true; state: GameState; events: GameEvent[] }
  | { accepted: false; state: GameState; reason: string; events: [] };
