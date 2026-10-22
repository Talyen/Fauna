import { CARDS, definition, species } from "../content";
import { PEARL } from "../content/creatures/memento";
import { creaturePassive } from "../progression";
import { roll, shuffle } from "../random";
import { recycleDiscard, receiveCard, MAX_BATTLE_CARDS, MAX_HAND_SIZE } from "../card-zones";
import { battlefield, isEnemy } from "../battlefield";
import { freshCombat, hit, restoreHealth, controlled } from "./index";
import type { Combatant } from "./state";
import type { BattleState, Enemy, EnemyDeck, GameEvent, GameState } from "../types";
const MINION_LIMIT = 2;
export function bossDeck(state: GameState, enemy: Enemy): EnemyDeck {
  return {
    draw: shuffle(
      state,
      CARDS.filter((card) => card.species === enemy.species).flatMap((card) => [card.id, card.id]),
    ),
    hand: [],
    buffer: [],
    discard: [],
    mana: 4,
    pearls: 0,
  };
}
export function drawBossCards(state: GameState, deck: EnemyDeck, count: number) {
  while (deck.hand.length < MAX_HAND_SIZE && deck.buffer.length) deck.hand.push(deck.buffer.shift()!);
  recycleDiscard(state, deck);
  for (let i = 0; i < count; i++) {
    const id = deck.draw.pop();
    if (!id) break;
    (deck.hand.length < MAX_HAND_SIZE ? deck.hand : deck.buffer).push(id);
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
  let created = 0;
  for (let i = 0; i < count; i++) {
    if (side === "enemy" && "deck" in actor && actor.deck) {
      const deck = actor.deck;
      if (deck.pearls >= MAX_BATTLE_CARDS - 6) break;
      deck.pearls++;
      (deck.hand.length < MAX_HAND_SIZE ? deck.hand : deck.buffer).push(PEARL.id);
    } else {
      if (state.cards.length >= MAX_BATTLE_CARDS || state.battle.copySerial >= Number.MAX_SAFE_INTEGER) break;
      const card = {
        id: `copy-${state.battle.copySerial++}`,
        definitionId: PEARL.id,
        ownerId: actor.id,
        level: 0,
        temporary: true as const,
      };
      state.cards.push(card);
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
  const owned = minions.filter((unit) => unit.minion.ownerId === actor.id);
  const alive = owned.filter((unit) => unit.health > 0);
  if (alive.length >= MINION_LIMIT) {
    for (const unit of alive) restoreHealth(unit, unit.maxHealth, events, false, state);
    return;
  }
  const old = owned.find((unit) => unit.health === 0);
  const id = old?.id ?? `echo-${actor.id}-${owned.length}`;
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
  const amount = creaturePassive(isEnemy(actor) ? undefined : state, actor.species).effects.reduce(
    (sum, effect) => sum + (effect.kind === "courtRemembers" ? effect.amount : 0),
    0,
  );
  if (!amount) return;
  const echoes = (state.battle.minions ?? []).filter(
    (unit) => unit.minion.ownerId === actor.id && unit.health > 0 && !controlled(unit),
  );
  const enemies = battlefield(state, isEnemy(actor) ? "player" : "enemy").filter((unit) => unit.health > 0);
  if (!echoes.length || !enemies.length) return;
  const echo = echoes[Math.floor(roll(state) * echoes.length)]!;
  const target = enemies[Math.floor(roll(state) * enemies.length)]!;
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
  const present = new Set(
    [...state.team, ...state.battle.enemies].filter((unit) => unit.health > 0).map((unit) => unit.id),
  );
  // Retain inert records for status-source receipts until combat ends; they never act or render.
  for (const unit of state.battle.minions) if (!present.has(unit.minion.ownerId)) unit.health = 0;
  const targets = new Set(battlefield(state, "player").map((unit) => unit.id));
  for (const enemy of state.battle.enemies)
    if (!targets.has(enemy.targetId)) enemy.targetId = state.team[0]!.id;
}
export function bossCardPriority(state: BattleState, enemy: Enemy, id: string) {
  const def = definition(id);
  if (def.effect === "procession") {
    const echoes = (state.battle.minions ?? []).filter(
      (unit) => unit.minion.ownerId === enemy.id && unit.health > 0,
    );
    return echoes.length < MINION_LIMIT ? 5 : echoes.some((unit) => unit.health < unit.maxHealth) ? 4 : 1;
  }
  return def.effect === "draw" &&
    !(state.battle.minions ?? []).some((unit) => unit.minion.ownerId === enemy.id && unit.health > 0)
    ? 4
    : def.effect === "pearl"
      ? 3
      : def.effect === "createPearls"
        ? 2
        : 1;
}
