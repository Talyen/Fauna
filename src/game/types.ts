import type { SpeciesId, DamageType } from "./content";
import type { Keyword, KeywordXP, RelicId } from "./progression";
export interface Creature {
  id: string;
  species: SpeciesId;
  health: number;
  block: number;
  attacked: boolean;
}
export interface Card {
  id: string;
  definitionId: string;
  ownerId: string;
  level: number;
}
export interface Enemy {
  id: string;
  name: string;
  species: SpeciesId;
  health: number;
  maxHealth: number;
  damage: number;
  marks: number;
  targetId: string;
}
export interface Battle {
  turn: number;
  mana: number;
  draw: string[];
  hand: string[];
  discard: string[];
  enemies: Enemy[];
}
export interface BattleReward {
  xp: KeywordXP;
  currency: number;
  recruits: SpeciesId[];
  relics: RelicId[];
  outcome: "next" | "victory" | "defeat";
}
export interface GameState {
  version: 5;
  revision: number;
  rng: number;
  phase: "draft" | "teamSelection" | "battle" | "reward" | "recruit" | "relic" | "victory" | "defeat";
  unlocked: SpeciesId[];
  wins: number;
  selected: SpeciesId[];
  roster: SpeciesId[];
  reserves: Creature[];
  lineup: SpeciesId[];
  team: Creature[];
  cards: Card[];
  encounter: number;
  expedition: {
    biome: number;
    step: number;
    offers: { location: string; pack: number }[];
    chosen: string | null;
  } | null;
  battle: Battle | null;
  keywordXP: KeywordXP;
  battleXP: KeywordXP;
  talents: string[];
  currency: number;
  relics: RelicId[];
  reward: BattleReward | null;
}
export type Command =
  | { type: "draft"; species: SpeciesId }
  | { type: "start" }
  | { type: "beginBattle"; destination?: string }
  | { type: "setLineup"; activeId: string; reserve: SpeciesId }
  | { type: "swap"; activeId: string; reserve: SpeciesId }
  | { type: "play"; cardId: string; targetId?: string }
  | { type: "endTurn" }
  | { type: "continueReward" }
  | { type: "recruit"; species: SpeciesId; replace?: SpeciesId }
  | { type: "skipRecruit" }
  | { type: "chooseRelic"; relic: RelicId }
  | { type: "skipRelic" }
  | { type: "buyTalent"; talentId: string }
  | { type: "resetTalents"; keyword: Keyword }
  | { type: "newRun"; seed: number }
  | { type: "abandon" };
export interface GameEvent {
  kind: "action" | "mark" | "damage" | "block" | "heal" | "knockout" | "turn" | "reward" | "victory";
  text: string;
  actorId?: string;
  targetId?: string;
  amount?: number;
  damageType?: DamageType;
}
export type CommandResult =
  | { accepted: true; state: GameState; events: GameEvent[] }
  | { accepted: false; state: GameState; reason: string; events: [] };
