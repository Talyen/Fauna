import { emitSupport } from "../events";
import { createTemporaryCard } from "../card-zones";
import { forEachPermanentCard, permanentKitSize } from "../card-kit";
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
import { battlefieldView, battlefieldHasId, livingBattlefield, isEnemy } from "../battlefield";
import { freshCombat, hit, restoreHealth, controlled } from "./index";
import type { Combatant } from "./state";
import type { BattleState, Enemy, EnemyDeck, GameEvent, GameState } from "../types";
const MINION_LIMIT = 2;
const PENDULUM_HEALTH = 6;

function minionSlot(state: BattleState, actor: Combatant, prefix: string) {
  const minions = state.battle.minions ?? (state.battle.minions = []);
  const owned = minions.filter((unit) => unit.minion.ownerId === actor.id);
  if (owned.filter((unit) => unit.health > 0).length >= MINION_LIMIT) return undefined;
  for (let slot = 0; slot < MINION_LIMIT; slot++) {
    const id = `${prefix}-${actor.id}-${slot}`;
    const index = minions.findIndex((unit) => unit.id === id);
    if (index >= 0) {
      if (minions[index]!.health <= 0) return { id, index };
      continue;
    }
    const vacant = minions.findIndex((unit) => {
      if (unit.minion.ownerId !== actor.id || unit.health > 0) return false;
      // A status or deferred Leech payment may still belong to this summon.
      return ![...state.team, ...state.reserves, ...state.battle.enemies, ...minions].some(
        (other) =>
          Object.values(other.combat?.statusSources ?? {}).includes(unit.id) ||
          other.combat?.bleedLeech.some((payment) => payment.sourceId === unit.id),
      );
    });
    return { id, index: vacant };
  }
  return undefined;
}

/** Recreate each fixed slot on entry, or only the first broken slot for Bridge Rewind. */
export function summonPendulums(
  state: BattleState,
  actor: Combatant,
  side: "player" | "enemy",
  events: GameEvent[],
  count = 2,
  borrowed = false,
) {
  if (
    actor.health <= 0 ||
    (!borrowed && !passiveAmount(side === "player" ? state : undefined, actor.species, "turnBackTide"))
  )
    return;
  const minions = state.battle.minions ?? (state.battle.minions = []);
  while (count > 0) {
    const slot = minionSlot(state, actor, "pendulum");
    if (!slot) break;
    const { id, index } = slot;
    const pendulum = {
      id,
      name: "Pendulum" as const,
      species: "chronora" as const,
      health: PENDULUM_HEALTH,
      maxHealth: PENDULUM_HEALTH,
      power: 1,
      targetId: actor.id,
      block: 0,
      combat: freshCombat(),
      lastAbility: null,
      minion: { ownerId: actor.id, side },
    };
    if (index < 0) minions.push(pendulum);
    else minions[index] = pendulum;
    count--;
    emitSupport(events, actor.id, { targetId: id, text: "Chronora summons a Pendulum" });
  }
}

/** Recreate the first vacant garden position; entry creates both positions. */
export function summonRoyalBlooms(
  state: BattleState,
  actor: Combatant,
  side: "player" | "enemy",
  events: GameEvent[],
  count = 2,
  health = 6,
  borrowed = false,
) {
  if (
    actor.health <= 0 ||
    (!borrowed && !passiveAmount(side === "player" ? state : undefined, actor.species, "gardenAnswers"))
  )
    return;
  const minions = state.battle.minions ?? (state.battle.minions = []);
  while (count > 0) {
    const slot = minionSlot(state, actor, "bloom");
    if (!slot) break;
    const { id, index } = slot;
    const bloom = {
      id,
      name: "Royal Bloom" as const,
      species: "velvetmonarch" as const,
      health,
      maxHealth: health,
      power: 1,
      targetId: actor.id,
      block: 0,
      combat: freshCombat(),
      lastAbility: null,
      minion: { ownerId: actor.id, side },
    };
    if (index < 0) minions.push(bloom);
    else minions[index] = bloom;
    count--;
    emitSupport(events, actor.id, {
      targetId: id,
      text: `${species(actor.species).name} summons a Royal Bloom`,
    });
  }
}

/** Fill the owner's vacant ward slots; existing wards are not refreshed. */
export function summonGildedWards(
  state: BattleState,
  actor: Combatant,
  side: "player" | "enemy",
  events: GameEvent[],
) {
  if (actor.health <= 0) return;
  const minions = state.battle.minions ?? (state.battle.minions = []);
  for (let count = 0; count < 2; count++) {
    const slot = minionSlot(state, actor, "ward");
    if (!slot) break;
    const ward = {
      id: slot.id,
      name: "Gilded Ward" as const,
      species: "tithemaw" as const,
      health: 4,
      maxHealth: 4,
      power: 1,
      targetId: actor.id,
      block: 0,
      combat: freshCombat(),
      lastAbility: null,
      minion: { ownerId: actor.id, side },
    };
    if (slot.index < 0) minions.push(ward);
    else minions[slot.index] = ward;
    emitSupport(events, actor.id, {
      targetId: ward.id,
      text: `${species(actor.species).name} summons a Gilded Ward`,
    });
  }
}

/** Each living uncontrolled Ward answers each completed owner attack once. */
export function goldenChorus(state: BattleState, actor: Combatant, events: GameEvent[]) {
  const wards = (state.battle.minions ?? []).filter(
    (unit) =>
      unit.species === "tithemaw" && unit.minion.ownerId === actor.id && unit.health > 0 && !controlled(unit),
  );
  const side = isEnemy(actor) ? "player" : "enemy";
  for (const ward of wards) {
    if (actor.health <= 0) break;
    if (ward.health <= 0 || controlled(ward)) continue;
    for (const target of livingBattlefield(state, side)) {
      if (actor.health <= 0 || ward.health <= 0) break;
      hit(state, ward, target, 1, "light", events, { origin: "derived" });
    }
  }
}

export function pendulumBonus(state: BattleState, actor: Combatant): number {
  if (actor.species !== "chronora") return 0;
  return (state.battle.minions ?? []).filter(
    (unit) => unit.species === "chronora" && unit.minion.ownerId === actor.id && unit.health > 0,
  ).length;
}
export function bossDeck(state: GameState, enemy: Enemy): EnemyDeck {
  const ids: string[] = [];
  forEachPermanentCard(enemy.species, (card) => ids.push(card.id));
  return {
    draw: shuffle(state, ids),
    hand: [],
    buffer: [],
    discard: [],
    mana: TURN_MANA,
    pearls: 0,
  };
}
export function drawBossCards(state: GameState, deck: EnemyDeck, count: number, turnStart = false) {
  promoteBufferedCards(deck, MAX_HAND_SIZE);
  for (let i = 0; i < count; i++) {
    if (turnStart) recycleDiscard(state, deck);
    const id = deck.draw.pop();
    if (!id) break;
    queueCard(deck, MAX_HAND_SIZE, id);
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
      const card = createTemporaryCard(state, {
        definitionId: PEARL.id,
        ownerId: actor.id,
        level: 0,
        ...(actor.species !== "memento" ? { borrowedFrom: "memento" as const } : {}),
      });
      if (!card) break;
      receiveCard(state, card.id);
    }
    created++;
  }
  if (created)
    emitSupport(events, actor.id, {
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
  let alive: (typeof minions)[number][] | undefined;
  for (let index = 0; index < minions.length; index++) {
    const unit = minions[index]!;
    if (unit.minion.ownerId !== actor.id) continue;
    if (unit.health > 0) (alive ??= []).push(unit);
  }
  if (alive && alive.length >= MINION_LIMIT) {
    for (const unit of alive) restoreHealth(unit, unit.maxHealth, events, false, state);
    return;
  }
  const slot = minionSlot(state, actor, "echo");
  if (!slot) return;
  const { id, index } = slot;
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
  if (index >= 0) minions[index] = echo;
  else minions.push(echo);
  emitSupport(events, actor.id, { targetId: id, text: "Memento summons an Echo" });
}
/** Exactly once per accepted card, after its effects; summons can answer their own creation. */
export function courtRemembers(state: BattleState, actor: Combatant, events: GameEvent[]) {
  if (actor.health <= 0) return;
  if (!state.battle.minions?.length) return;
  const amount = passiveAmount(isEnemy(actor) ? undefined : state, actor.species, "courtRemembers");
  if (!amount) return;
  const echoes = state.battle.minions.filter(
    (unit) => unit.minion.ownerId === actor.id && unit.health > 0 && !controlled(unit),
  );
  if (!echoes.length) return;
  const enemies = livingBattlefield(state, isEnemy(actor) ? "player" : "enemy");
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
  if (state.battle.minions.length === 1) {
    const unit = state.battle.minions[0]!;
    if (
      !state.team.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId) &&
      !state.battle.enemies.some((owner) => owner.health > 0 && owner.id === unit.minion.ownerId)
    )
      unit.health = 0;
  } else if (state.battle.minions.length > 1) {
    const present = new Set<string>();
    for (const unit of state.team) if (unit.health > 0) present.add(unit.id);
    for (const unit of state.battle.enemies) if (unit.health > 0) present.add(unit.id);
    // Retain inert records for status-source receipts until combat ends; they never act or render.
    for (const unit of state.battle.minions) if (!present.has(unit.minion.ownerId)) unit.health = 0;
  }
  if (!state.battle.enemies.length) return;
  if (state.battle.enemies.length === 1) {
    const enemy = state.battle.enemies[0]!;
    if (!battlefieldHasId(state, "player", enemy.targetId)) enemy.targetId = state.team[0]!.id;
    return;
  }
  const targets = new Set<string>();
  for (const unit of battlefieldView(state, "player")) targets.add(unit.id);
  for (const enemy of state.battle.enemies)
    if (!targets.has(enemy.targetId)) enemy.targetId = state.team[0]!.id;
}
