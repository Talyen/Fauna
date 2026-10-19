import type { SpeciesId, DamageType } from "./content";
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
  energy: number;
  draw: string[];
  hand: string[];
  discard: string[];
  enemies: Enemy[];
}
export interface GameState {
  version: 1;
  revision: number;
  rng: number;
  phase: "draft" | "battle" | "reward" | "victory" | "defeat";
  unlocked: SpeciesId[];
  wins: number;
  selected: SpeciesId[];
  team: Creature[];
  cards: Card[];
  encounter: number;
  battle: Battle | null;
}
export type Command =
  | { type: "draft"; species: SpeciesId }
  | { type: "start" }
  | { type: "play"; cardId: string; targetId?: string }
  | { type: "endTurn" }
  | { type: "upgrade"; cardId: string }
  | { type: "recruit"; species: SpeciesId; replaceId: string }
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
