import type { SpeciesId, DamageType } from "./content";
import type { Keyword, KeywordXP, BoonId } from "./progression";
export interface CombatState {
  controlTurns: number;
  rhythm: number;
  nextPhysical: number;
  partingCut: boolean;
  riposte: boolean;
  freeNature: boolean;
  freeLight: boolean;
  freeCard: boolean;
  desperateGuardUsed: boolean;
  armor: number;
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
interface Battle {
  earnedGold: number;
  freeBurnUsed: boolean;
  meteoriteUsed: boolean;
  cardsPlayedThisTurn: number;
  turn: number;
  mana: number;
  maxMana: number;
  draw: string[];
  hand: string[];
  buffer: string[];
  discard: string[];
  enemies: Enemy[];
}
interface BattleReward {
  xp: KeywordXP;
  currency: number;
  recruits: SpeciesId[];
  boons: BoonId[];
  outcome: "next" | "victory" | "defeat";
}
interface JourneySummary {
  outcome: "victory" | "defeat" | "returned" | null;
  victories: number;
  currency: number;
  xp: KeywordXP;
  unlocks: SpeciesId[];
  lastBattle: { xp: KeywordXP; currency: number } | null;
}
export interface GameState {
  version: 22;
  discovery: { encountered: SpeciesId[]; recruited: Partial<Record<SpeciesId, number>> };
  revision: number;
  rng: number;
  phase:
    "draft" | "teamSelection" | "battle" | "recruit" | "boon" | "campfire" | "support" | "victory" | "defeat";
  unlocked: SpeciesId[];
  wins: number;
  selected: SpeciesId[];
  starterOffers: SpeciesId[];
  /** Species counts, including copies; individual state lives in team and reserves. */
  roster: SpeciesId[];
  reserves: Creature[];
  /** Creature IDs in starting order, independent of tactical combat swaps. */
  lineup: string[];
  team: Creature[];
  cards: Card[];
  encounter: number;
  expedition: {
    pack: number | null;
  } | null;
  support: {
    id: string;
    kind: "merchant";
    encounter: number;
    resolved: boolean;
    purchased: BoonId | null;
    stock: { slot: string; boon: BoonId; price: number }[];
  } | null;
  battle: Battle | null;
  keywordXP: KeywordXP;
  battleXP: KeywordXP;
  talents: string[];
  currency: number;
  boons: BoonId[];
  reward: BattleReward | null;
  journey: JourneySummary | null;
}
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
  | { type: "enterSupport"; visit: string }
  | { type: "buyBoon"; visit: string; slot: string }
  | { type: "leaveSupport"; visit: string }
  | { type: "recruit"; species: SpeciesId; replace?: string }
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
}
export type CommandResult =
  | { accepted: true; state: GameState; events: GameEvent[] }
  | { accepted: false; state: GameState; reason: string; events: [] };
