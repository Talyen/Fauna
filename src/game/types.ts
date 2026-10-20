import type { SpeciesId, DamageType } from "./content";
import type { Keyword, KeywordXP, RelicId } from "./progression";
export interface CombatState {
  armor: number;
  forge: number;
  thorns: number;
  dodge: number;
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
}
export interface Enemy {
  id: string;
  name: string;
  species: SpeciesId;
  health: number;
  maxHealth: number;
  damage: number;
  targetId: string;
  block: number;
  combat: CombatState;
  lastAbility: string | null;
}
export interface Battle {
  turn: number;
  mana: number;
  maxMana: number;
  draw: string[];
  hand: string[];
  buffer: string[];
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
export interface JourneySummary {
  outcome: "victory" | "defeat" | "returned" | null;
  victories: number;
  currency: number;
  xp: KeywordXP;
  unlocks: SpeciesId[];
  lastBattle: { xp: KeywordXP; currency: number } | null;
}
export interface GameState {
  version: 12;
  discovery: { encountered: SpeciesId[]; recruited: SpeciesId[] };
  revision: number;
  rng: number;
  phase: "draft" | "teamSelection" | "battle" | "recruit" | "relic" | "campfire" | "victory" | "defeat";
  unlocked: SpeciesId[];
  wins: number;
  selected: SpeciesId[];
  /** Species counts, including copies; individual state lives in team and reserves. */
  roster: SpeciesId[];
  reserves: Creature[];
  /** Creature IDs in starting order, independent of tactical combat swaps. */
  lineup: string[];
  team: Creature[];
  cards: Card[];
  encounter: number;
  expedition: {
    biome: number;
    campfireUsed?: boolean;
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
  journey: JourneySummary | null;
}
export type Command =
  | { type: "draft"; species: SpeciesId }
  | { type: "start" }
  | { type: "beginBattle"; destination?: string }
  | { type: "setLineup"; activeId: string; reserve: string }
  | { type: "swap"; activeId: string; reserve: string }
  | { type: "play"; cardId: string; targetId?: string; autoEndTurn?: boolean }
  | { type: "endTurn" }
  | { type: "devWinBattle" }
  | { type: "visitCampfire" }
  | { type: "rest" }
  | { type: "recruit"; species: SpeciesId; replace?: string }
  | { type: "skipRecruit" }
  | { type: "chooseRelic"; relic: RelicId }
  | { type: "skipRelic" }
  | { type: "buyTalent"; talentId: string }
  | { type: "resetTalents"; keyword: Keyword }
  | { type: "newRun"; seed: number }
  | { type: "abandon" };
export interface GameEvent {
  kind: "action" | "damage" | "block" | "heal" | "knockout" | "turn" | "reward" | "victory" | "status";
  text: string;
  actorId?: string;
  targetId?: string;
  amount?: number;
  damageType?: DamageType;
}
export type CommandResult =
  | { accepted: true; state: GameState; events: GameEvent[] }
  | { accepted: false; state: GameState; reason: string; events: [] };
