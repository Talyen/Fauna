import { battleCardCapacity, createTemporaryCard } from "../card-zones";
import { permanentKit, permanentKitSize } from "../card-kit";
import { TURN_MANA } from "../state-limits";
import { species } from "../content";
import { PEARL } from "../content/creatures/memento";
import { passiveAmount } from "../progression";
import { roll, shuffle } from "../random";
import {
  recycleDiscard,
  receiveCard,
  promoteBufferedCards,
  queueCard,
  MAX_BATTLE_CARDS,
  MAX_HAND_SIZE,
} from "../card-zones";
import { battlefield, isEnemy } from "../battlefield";
import { freshCombat, hit, restoreHealth, controlled } from "./index";
import type { Combatant } from "./state";
import type { BattleState, Enemy, EnemyDeck, GameEvent, GameState } from "../types";
const MINION_LIMIT = 2;
export function bossDeck(state: GameState, enemy: Enemy): EnemyDeck {
  return {
    draw: shuffle(
      state,
      permanentKit(enemy.species).map(({ definition }) => definition.id),
    ),
    hand: [],
    buffer: [],
    discard: [],
    mana: TURN_MANA,
    pearls: 0,
  };
}
export function drawBossCards(state: GameState, deck: EnemyDeck, count: number) {
  promoteBufferedCards(deck, MAX_HAND_SIZE);
  recycleDiscard(state, deck);
  for (let i = 0; i < count; i++) {
    const id = deck.draw.pop();
    if (!id) break;
    queueCard(deck, MAX_HAND_SIZE, id);
    recycleDiscard(state, deck);
  }
}
export function createPearls(
  state: BattleState,
  actor: Combatant,
  side: "player" | "enemy",
  count: number,
  events: GameEvent[],
) {
  if (!(count > 0)) return;
  let created = 0;
  const enemyDeck = side === "enemy" && "deck" in actor ? actor.deck : undefined;
  const pearlLimit = enemyDeck ? MAX_BATTLE_CARDS - permanentKitSize(actor.species) : 0;
  for (let i = 0; i < count; i++) {
    if (enemyDeck) {
      const deck = enemyDeck;
      if (deck.pearls >= pearlLimit) break;
      deck.pearls++;
      queueCard(deck, MAX_HAND_SIZE, PEARL.id);
    } else {
      if (battleCardCapacity(state) === 0) break;
      const card = createTemporaryCard(state, {
        definitionId: PEARL.id,
        ownerId: actor.id,
        level: 0,
      })!;
      receiveCard(state, card.id);
    }
    created++;
  }
  if (created)
    events.push({
      kind: "action",
      actionType: "support",
      actorId: actor.id,
      amount: created,
      text: `${species(actor.species).name} creates ${created} Pearls`,
    });
}
export function summonEcho(
  state: BattleState,
  actor: Combatant,
  side: "player" | "enemy",
  health: number,
  events: GameEvent[],
) {
  const minions = state.battle.minions ?? (state.battle.minions = []);
  let ownedCount = 0;
  let old: (typeof minions)[number] | undefined;
  const alive: (typeof minions)[number][] = [];
  for (const unit of minions) {
    if (unit.minion.ownerId !== actor.id) continue;
    ownedCount++;
    if (unit.health > 0) alive.push(unit);
    else if (unit.health === 0 && !old) old = unit;
  }
  if (alive.length >= MINION_LIMIT) {
    for (const unit of alive) restoreHealth(unit, unit.maxHealth, events, false, state);
    return;
  }
  const id = old?.id ?? `echo-${actor.id}-${ownedCount}`;
  const echo = {
    id,
    name: "Echo" as const,
    species: "memento" as const,
    health,
    maxHealth: health,
    power: 1,
    targetId: actor.id,
    block: 0,
    combat: freshCombat(),
    lastAbility: null,
    minion: { ownerId: actor.id, side },
  };
  if (old) minions[minions.indexOf(old)] = echo;
  else minions.push(echo);
  events.push({
    kind: "action",
    actionType: "support",
    actorId: actor.id,
    targetId: id,
    text: "Memento summons an Echo",
  });
}
/** Exactly once per accepted card, after its effects; summons can answer their own creation. */
export function courtRemembers(state: BattleState, actor: Combatant, events: GameEvent[]) {
  if (actor.health <= 0) return;
  const amount = passiveAmount(isEnemy(actor) ? undefined : state, actor.species, "courtRemembers");
  if (!amount) return;
  const echoes = (state.battle.minions ?? []).filter(
    (unit) => unit.minion.ownerId === actor.id && unit.health > 0 && !controlled(unit),
  );
  if (!echoes.length) return;
  const enemies = battlefield(state, isEnemy(actor) ? "player" : "enemy").filter((unit) => unit.health > 0);
  if (!enemies.length) return;
  const echo = echoes[Math.floor(roll(state, { kind: "index", size: echoes.length }) * echoes.length)]!;
  const target = enemies[Math.floor(roll(state, { kind: "index", size: enemies.length }) * enemies.length)]!;
  events.push({
    kind: "action",
    actionType: "attack",
    actorId: echo.id,
    targetId: target.id,
    text: "The Court Remembers",
  });
  hit(state, echo, target, amount, "water", events, { origin: "ability" });
}
export function removeDepartedMinions(state: GameState) {
  if (!state.battle?.minions) return;
  const present = new Set<string>();
  for (const unit of state.team) if (unit.health > 0) present.add(unit.id);
  for (const unit of state.battle.enemies) if (unit.health > 0) present.add(unit.id);
  // Retain inert records for status-source receipts until combat ends; they never act or render.
  for (const unit of state.battle.minions) if (!present.has(unit.minion.ownerId)) unit.health = 0;
  const targets = new Set<string>();
  for (const unit of battlefield(state, "player")) targets.add(unit.id);
  for (const enemy of state.battle.enemies)
    if (!targets.has(enemy.targetId)) enemy.targetId = state.team[0]!.id;
}
