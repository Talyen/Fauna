import { freeze, produce } from "immer";
import { actionValue } from "./rules";
import {
  CARDS,
  ENCOUNTERS,
  INITIAL_SPECIES,
  definition,
  species,
  enemyDamageType,
  DAMAGE_LABELS,
} from "./content";
import type { Card, Command, CommandResult, GameEvent, GameState } from "./types";
export function createGame(seed = 1): GameState {
  return freeze(
    {
      version: 1,
      revision: 0,
      rng: seed >>> 0,
      phase: "draft",
      unlocked: [...INITIAL_SPECIES],
      wins: 0,
      selected: [],
      team: [],
      cards: [],
      encounter: 0,
      battle: null,
    },
    true,
  ) as GameState;
}
function random(state: GameState): number {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
function shuffle(state: GameState, cards: string[]): string[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}
function living(state: GameState) {
  return state.team.filter((c) => c.health > 0);
}
function ownedCards(id: string, kind: GameState["team"][number]["species"]): Card[] {
  return CARDS.filter((c) => c.species === kind).map((c) => ({
    id: `${id}:${c.id}`,
    definitionId: c.id,
    ownerId: id,
    level: 0,
  }));
}
function draw(state: GameState, count: number) {
  const b = state.battle!;
  for (let i = 0; i < count; i++) {
    if (!b.draw.length) {
      b.draw = shuffle(state, b.discard.splice(0));
    }
    const id = b.draw.pop();
    if (!id) break;
    b.hand.push(id);
  }
}
function intents(state: GameState) {
  const alive = living(state);
  for (const enemy of state.battle!.enemies) {
    if (enemy.health > 0) enemy.targetId = alive[Math.floor(random(state) * alive.length)]!.id;
  }
}
function beginBattle(state: GameState) {
  const encounter = ENCOUNTERS[state.encounter]!;
  for (const c of state.team) {
    c.health = species(c.species).health;
    c.block = c.species === "moonhart" ? 4 : 0;
    c.attacked = false;
  }
  state.battle = {
    turn: 1,
    energy: 3,
    draw: shuffle(
      state,
      state.cards.map((c) => c.id),
    ),
    hand: [],
    discard: [],
    enemies: encounter.enemies.map((e, i) => ({
      id: `enemy-${i}`,
      name: e.name,
      species: e.species,
      health: e.health,
      maxHealth: e.health,
      damage: e.damage,
      marks: 0,
      targetId: "",
    })),
  };
  state.phase = "battle";
  draw(state, 5);
  intents(state);
}
function settle(state: GameState, events: GameEvent[]): boolean {
  if (!living(state).length) {
    state.phase = "defeat";
    events.push({ kind: "knockout", text: "Your expedition has ended." });
    return true;
  }
  if (state.battle!.enemies.every((e) => e.health <= 0)) {
    for (const c of state.team) {
      c.health = species(c.species).health;
      c.block = 0;
    }
    if (state.encounter === 2) {
      state.phase = "victory";
      state.wins++;
      if (!state.unlocked.includes("moonhart")) state.unlocked.push("moonhart");
      events.push({ kind: "victory", text: "The wilds are quiet. Expedition complete." });
    } else {
      state.phase = "reward";
      events.push({ kind: "reward", text: "Trail cleared. Recruit a creature or strengthen a card." });
    }
    return true;
  }
  return false;
}
function reject(state: GameState, reason: string): CommandResult {
  return { accepted: false, state, reason, events: [] };
}
export function dispatch(state: GameState, command: Command): CommandResult {
  const b = state.battle;
  if (
    command.type === "newRun" &&
    (!Number.isSafeInteger(command.seed) || command.seed < 0 || command.seed > 0xffffffff)
  )
    return reject(state, "Choose a valid expedition seed.");
  if (
    command.type === "draft" &&
    (state.phase !== "draft" ||
      !state.unlocked.includes(command.species) ||
      (!state.selected.includes(command.species) && state.selected.length >= 3))
  )
    return reject(state, "Choose up to three unlocked creatures.");
  if (command.type === "start" && (state.phase !== "draft" || state.selected.length !== 3))
    return reject(state, "Choose three creatures first.");
  if ((command.type === "play" || command.type === "endTurn") && (state.phase !== "battle" || !b))
    return reject(state, "There is no active battle.");
  if (command.type === "play") {
    const card = state.cards.find((c) => c.id === command.cardId);
    if (!card || !b!.hand.includes(card.id)) return reject(state, "That card is not in your hand.");
    const actor = state.team.find((c) => c.id === card.ownerId);
    if (!actor || actor.health <= 0) return reject(state, "That creature is knocked out.");
    const def = definition(card.definitionId);
    if (b!.energy < def.cost) return reject(state, "Not enough energy.");
    if (
      (def.effect === "attack" || def.effect === "mark") &&
      !b!.enemies.some((e) => e.id === command.targetId && e.health > 0)
    )
      return reject(state, "Choose a living enemy.");
    if (
      (def.effect === "guard" || def.effect === "heal") &&
      !state.team.some((c) => c.id === command.targetId && c.health > 0)
    )
      return reject(state, "Choose a living ally.");
  }
  if (
    command.type === "upgrade" &&
    (state.phase !== "reward" || !state.cards.some((c) => c.id === command.cardId && c.level < 3))
  )
    return reject(state, "Choose a card below upgrade level three.");
  if (
    command.type === "recruit" &&
    (state.phase !== "reward" ||
      !state.unlocked.includes(command.species) ||
      state.team.some((c) => c.species === command.species) ||
      !state.team.some((c) => c.id === command.replaceId))
  )
    return reject(state, "Choose an available species and a teammate to replace.");
  if (command.type === "abandon" && !["battle", "reward"].includes(state.phase))
    return reject(state, "There is no expedition to end.");
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    draft.revision++;
    switch (command.type) {
      case "draft": {
        const i = draft.selected.indexOf(command.species);
        if (i >= 0) draft.selected.splice(i, 1);
        else draft.selected.push(command.species);
        break;
      }
      case "start":
        draft.team = draft.selected.map((kind, i) => ({
          id: `ally-${i}`,
          species: kind,
          health: species(kind).health,
          block: 0,
          attacked: false,
        }));
        draft.cards = draft.team.flatMap((c) => ownedCards(c.id, c.species));
        beginBattle(draft);
        events.push({ kind: "turn", text: "Your expedition begins." });
        break;
      case "play": {
        const battle = draft.battle!;
        const card = draft.cards.find((c) => c.id === command.cardId)!;
        const def = definition(card.definitionId);
        const actor = draft.team.find((c) => c.id === card.ownerId)!;
        let value = actionValue(card, actor);
        battle.energy -= def.cost;
        battle.hand.splice(battle.hand.indexOf(card.id), 1);
        battle.discard.push(card.id);
        events.push({
          kind: "action",
          text: `${species(actor.species).name} uses ${def.name}.`,
          actorId: actor.id,
          targetId: command.targetId,
        });
        if (def.effect === "attack") {
          const enemy = battle.enemies.find((e) => e.id === command.targetId)!;
          value += enemy.marks * 3;
          enemy.marks = 0;
          const removed = Math.min(enemy.health, value);
          enemy.health = Math.max(0, enemy.health - value);
          actor.attacked = true;
          events.push({
            kind: "damage",
            text: `${enemy.name} takes ${removed} ${DAMAGE_LABELS[def.damageType]} damage.`,
            damageType: def.damageType,
            targetId: enemy.id,
            amount: removed,
          });
          if (enemy.health === 0)
            events.push({ kind: "knockout", targetId: enemy.id, text: `${enemy.name} is knocked out.` });
        }
        if (def.effect === "mark") {
          const enemy = battle.enemies.find((e) => e.id === command.targetId)!;
          enemy.marks += value;
          events.push({
            kind: "mark",
            text: `${enemy.name} gains ${value} marks.`,
            targetId: enemy.id,
            amount: value,
          });
        }
        if (def.effect === "guard" || def.effect === "teamGuard") {
          const targets =
            def.effect === "teamGuard" ? living(draft) : draft.team.filter((c) => c.id === command.targetId);
          for (const target of targets) {
            target.block += value;
            events.push({
              kind: "block",
              text: `${species(target.species).name} gains ${value} block.`,
              targetId: target.id,
              amount: value,
            });
          }
        }
        if (def.effect === "heal") {
          const target = draft.team.find((c) => c.id === command.targetId)!;
          const amount = Math.min(value, species(target.species).health - target.health);
          target.health += amount;
          events.push({
            kind: "heal",
            text: `${species(target.species).name} recovers ${amount} health.`,
            targetId: target.id,
            amount,
          });
        }
        settle(draft, events);
        break;
      }
      case "endTurn": {
        const battle = draft.battle!;
        for (const enemy of battle.enemies) {
          if (enemy.health <= 0) continue;
          const target = living(draft).find((c) => c.id === enemy.targetId) ?? living(draft)[0];
          if (!target) break;
          const blocked = Math.min(target.block, enemy.damage);
          target.block -= blocked;
          const amount = Math.min(target.health, enemy.damage - blocked);
          if (blocked > 0)
            events.push({
              kind: "block",
              actorId: enemy.id,
              targetId: target.id,
              amount: -blocked,
              text: `${species(target.species).name} blocks ${blocked} damage.`,
            });
          target.health = Math.max(0, target.health - amount);
          events.push({
            kind: "damage",
            text: `${enemy.name} hits ${species(target.species).name} for ${amount} ${DAMAGE_LABELS[enemyDamageType(draft.encounter, enemy.id)]} damage${blocked ? ` (${blocked} blocked)` : ""}.`,
            damageType: enemyDamageType(draft.encounter, enemy.id),
            actorId: enemy.id,
            targetId: target.id,
            amount,
          });
          if (target.species === "briartooth" && amount > 0) {
            const reflected = Math.min(enemy.health, 2);
            enemy.health = Math.max(0, enemy.health - 2);
            events.push({
              kind: "damage",
              text: `Thorns deal ${reflected} Nature damage to ${enemy.name}.`,
              damageType: "nature",
              targetId: enemy.id,
              amount: reflected,
            });
            if (enemy.health === 0)
              events.push({ kind: "knockout", targetId: enemy.id, text: `${enemy.name} is knocked out.` });
          }
          if (target.health === 0) {
            events.push({
              kind: "knockout",
              text: `${species(target.species).name} is knocked out.`,
              targetId: target.id,
            });
            const removed = new Set(draft.cards.filter((c) => c.ownerId === target.id).map((c) => c.id));
            battle.draw = battle.draw.filter((id) => !removed.has(id));
            battle.hand = battle.hand.filter((id) => !removed.has(id));
            battle.discard = battle.discard.filter((id) => !removed.has(id));
          }
          if (settle(draft, events)) break;
        }
        if (draft.phase !== "battle") break;
        for (const c of draft.team) {
          c.block = 0;
          c.attacked = false;
        }
        battle.discard.push(...battle.hand.splice(0));
        battle.energy = 3;
        battle.turn++;
        draw(draft, 5);
        intents(draft);
        events.push({ kind: "turn", text: `Turn ${battle.turn}. Three energy restored.` });
        break;
      }
      case "upgrade": {
        draft.cards.find((c) => c.id === command.cardId)!.level++;
        draft.encounter++;
        beginBattle(draft);
        events.push({ kind: "reward", text: "Card strengthened. A new trail awaits." });
        break;
      }
      case "recruit": {
        const target = draft.team.find((c) => c.id === command.replaceId)!;
        target.species = command.species;
        draft.cards = draft.cards.filter((c) => c.ownerId !== target.id);
        draft.cards.push(...ownedCards(target.id, command.species));
        draft.encounter++;
        beginBattle(draft);
        events.push({ kind: "reward", text: `${species(command.species).name} joins the expedition.` });
        break;
      }
      case "newRun": {
        const fresh = createGame(command.seed);
        Object.assign(draft, fresh, {
          revision: state.revision + 1,
          unlocked: [...state.unlocked],
          wins: state.wins,
        });
        break;
      }
      case "abandon":
        draft.phase = "defeat";
        events.push({ kind: "knockout", text: "You return from the wilds. Discoveries are kept." });
        break;
    }
  });
  return { accepted: true, state: next, events };
}
