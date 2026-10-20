import { freeze, produce } from "immer";
import { KEYWORDS, RELICS, cardKeywords, canBuyTalent, hasTalent } from "./progression";
import {
  combat,
  freshCombat,
  grantStatus,
  hit,
  restoreHealth,
  removeEffects,
  roll,
  startAction,
  tickStatuses,
  controlled,
  TURN_MANA,
  TURN_DRAW,
  HAND_LIMIT,
} from "./combat";
import { actionValue, cardFollowups, enemyAbilityValue } from "./rules";
import { CARDS, INITIAL_SPECIES, definition, species, enemyCard } from "./content";
import { BIOMES, bossEncounter, encounterSource, finalEncounter, location } from "./destinations";
import type { Card, Command, CommandResult, GameEvent, GameState } from "./types";
export function createGame(seed = 1): GameState {
  return freeze(
    {
      version: 12,
      discovery: { encountered: [], recruited: [] },
      revision: 0,
      rng: seed >>> 0,
      phase: "draft",
      unlocked: [...INITIAL_SPECIES],
      wins: 0,
      selected: [],
      roster: [],
      reserves: [],
      lineup: [],
      keywordXP: {},
      battleXP: {},
      talents: [],
      currency: 0,
      relics: [],
      reward: null,
      journey: null,
      team: [],
      cards: [],
      encounter: 0,
      expedition: { biome: 0, step: 0, offers: [], chosen: null },
      battle: null,
    },
    true,
  ) as GameState;
}
const random = roll;
function shuffle<T>(state: GameState, cards: T[]): T[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}
function offerDestinations(state: GameState) {
  const route = state.expedition!;
  const biome = BIOMES[route.biome]!;
  const places =
    route.step === 3
      ? [biome.boss]
      : shuffle(
          state,
          biome.locations.filter((id) => id !== route.chosen),
        ).slice(0, 3);
  route.offers = places.map((id) => ({
    location: id,
    pack: Math.floor(random(state) * location(id)!.packs.length),
  }));
  route.chosen = null;
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
export const MAX_HAND_SIZE = HAND_LIMIT;
function fillHand(state: GameState) {
  const battle = state.battle!;
  while (battle.hand.length < MAX_HAND_SIZE && battle.buffer.length) battle.hand.push(battle.buffer.shift()!);
}
function draw(state: GameState, count: number) {
  fillHand(state);
  const b = state.battle!;
  // Knocked-out owners retain inert slots, so replacing them cannot refresh spent cards.
  const alive = living(state);
  const eligible = (id: string) =>
    !alive.length || alive.some((c) => c.id === state.cards.find((card) => card.id === id)?.ownerId);
  for (let i = 0; i < count; i++) {
    if (!b.draw.some(eligible)) {
      const available = b.discard.filter(eligible);
      b.discard = b.discard.filter((id) => !eligible(id));
      b.draw.push(...shuffle(state, available));
    }
    let index = b.draw.length - 1;
    while (index >= 0 && !eligible(b.draw[index]!)) index--;
    if (index < 0) break;
    const card = b.draw.splice(index, 1)[0]!;
    if (b.hand.length < MAX_HAND_SIZE) b.hand.push(card);
    else b.buffer.push(card);
  }
}
function intents(state: GameState) {
  const alive = living(state);
  for (const enemy of state.battle!.enemies) {
    if (enemy.health > 0)
      enemy.targetId = alive.length ? alive[Math.floor(random(state) * alive.length)]!.id : state.team[0]!.id;
  }
}
export function beginBattle(state: GameState) {
  const encounter = encounterSource(state);
  for (const enemy of encounter.enemies)
    if (!state.discovery.encountered.includes(enemy.species)) state.discovery.encountered.push(enemy.species);
  const all = [...state.team, ...state.reserves];
  state.team = state.lineup.map((id) => all.find((c) => c.id === id)!);
  state.reserves = all.filter((c) => !state.lineup.includes(c.id));
  rebuildCards(state);
  for (const c of [...state.team, ...state.reserves]) {
    c.combat = freshCombat();
    if (c.species === "briartooth" && state.team.includes(c)) c.combat.thorns = 2;
    c.block =
      (state.team.includes(c) && c.species === "moonhart" ? 4 : 0) +
      (state.team.includes(c) && state.relics.includes("river-shell") ? 3 : 0);
    for (const keyword of KEYWORDS)
      if (
        state.team.includes(c) &&
        hasTalent(state, keyword, "opening") &&
        state.cards.some((card) => card.ownerId === c.id && cardKeywords(card).includes(keyword))
      )
        c.block += 2;
    c.attacked = false;
  }
  state.battle = {
    turn: 1,
    mana: TURN_MANA,
    maxMana: TURN_MANA,
    draw: shuffle(
      state,
      state.cards.map((c) => c.id),
    ),
    hand: [],
    buffer: [],
    discard: [],
    enemies: encounter.enemies.map((e, i) => ({
      id: `enemy-${i}`,
      name: e.name,
      species: e.species,
      health: e.health,
      maxHealth: e.health,
      damage: e.damage,
      targetId: "",
      block: e.species === "moonhart" ? 4 : 0,
      combat: { ...freshCombat(), thorns: e.species === "briartooth" ? 2 : 0 },
      lastAbility: null,
    })),
  };
  state.phase = "battle";
  draw(state, TURN_DRAW + (state.relics.includes("wind-feather") ? 1 : 0));
  state.reward = null;
  state.battleXP = {};
  intents(state);
}
function bankBattleXP(state: GameState) {
  const xp: GameState["battleXP"] = {};
  for (const keyword of KEYWORDS) {
    const previous = state.keywordXP[keyword] ?? 0;
    const total = Math.min(1_000_000, previous + (state.battleXP[keyword] ?? 0));
    state.keywordXP[keyword] = total;
    if (total > previous) {
      xp[keyword] = total - previous;
      if (state.journey) state.journey.xp[keyword] = (state.journey.xp[keyword] ?? 0) + total - previous;
    }
  }
  state.battleXP = {};
  return xp;
}
function finishBattle(state: GameState, defeated: boolean) {
  const xp = bankBattleXP(state);
  const previousCurrency = state.currency;
  state.currency = Math.min(1_000_000, state.currency + (defeated ? 0 : bossEncounter(state) ? 40 : 20));
  const currency = state.currency - previousCurrency;
  const outcome = defeated ? "defeat" : finalEncounter(state) ? "victory" : "next";
  if (state.journey) {
    state.journey.currency += currency;
    state.journey.lastBattle = { xp, currency };
    if (!defeated) state.journey.victories++;
    if (outcome !== "next") state.journey.outcome = outcome;
  }
  if (outcome === "victory") {
    state.wins++;
    if (!state.unlocked.includes("moonhart")) {
      state.unlocked.push("moonhart");
      state.journey?.unlocks.push("moonhart");
    }
  }
  const relics =
    defeated || outcome === "victory" || !bossEncounter(state)
      ? []
      : shuffle(
          state,
          RELICS.filter((r) => !state.relics.includes(r.id)).map((r) => r.id),
        ).slice(0, 3);
  state.reward = {
    xp,
    currency,
    outcome,
    recruits:
      defeated || outcome === "victory" || bossEncounter(state)
        ? []
        : state.battle!.enemies.map((e) => e.species),
    relics: relics.length === 3 ? relics : [],
  };
  enterReward(state);
}
function settle(state: GameState, events: GameEvent[]): boolean {
  if (![...state.team, ...state.reserves].some((c) => c.health > 0)) {
    finishBattle(state, true);
    events.push({ kind: "knockout", text: "Your journey has ended." });
    return true;
  }
  if (state.battle!.enemies.every((e) => e.health <= 0)) {
    for (const creature of [...state.team, ...state.reserves]) {
      creature.block = 0;
      creature.combat = freshCombat();
    }
    for (const enemy of state.battle!.enemies) {
      enemy.combat = freshCombat();
      enemy.block = 0;
    }
    finishBattle(state, false);
    events.push({
      kind: state.phase === "victory" || state.reward?.outcome === "victory" ? "victory" : "reward",
      text: "Battle complete. Rewards saved.",
    });
    return true;
  }
  return false;
}
function prepareLineup(state: GameState) {
  const all = [...state.team, ...state.reserves];
  state.team = state.lineup.map((id) => all.find((c) => c.id === id)!);
  state.reserves = all.filter((c) => !state.lineup.includes(c.id));
  rebuildCards(state);
}
function afterRewards(state: GameState) {
  if (state.reward!.outcome === "victory") {
    state.phase = "victory";
    return;
  }
  state.encounter++;
  if (state.expedition) {
    if (state.expedition.step === 3) {
      state.expedition.biome++;
      state.expedition.campfireUsed = false;
      state.expedition.step = 0;
    } else state.expedition.step++;
    offerDestinations(state);
  }
  state.phase = "teamSelection";
  state.battle = null;
  state.reward = null;
  prepareLineup(state);
}
function enterReward(state: GameState) {
  const reward = state.reward!;
  if (reward.outcome === "defeat") state.phase = "defeat";
  else if (reward.outcome === "victory") state.phase = "victory";
  else if (reward.recruits.length > 0) state.phase = "recruit";
  else if (reward.relics.length) state.phase = "relic";
  else afterRewards(state);
}
function rebuildCards(state: GameState) {
  const previous = state.cards;
  state.cards = state.team
    .flatMap((c) => ownedCards(c.id, c.species))
    .map(
      (card) =>
        previous.find(
          (old) =>
            old.id === card.id && old.ownerId === card.ownerId && old.definitionId === card.definitionId,
        ) ?? card,
    );
  if (state.battle) {
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.discard = [];
    state.battle.draw = state.cards.map((c) => c.id);
  }
}
function applyExtras(
  state: GameState,
  actor: import("./combat").Combatant,
  def: import("./content").CardDefinition,
  events: GameEvent[],
  enemy = false,
  target?: import("./combat").Combatant,
) {
  for (const effect of def.effects ?? []) {
    if (actor.health <= 0) break;
    switch (effect.kind) {
      case "damage":
        if (target)
          hit(state, actor, target, effect.amount, effect.damageType, events, { leech: effect.leech });
        break;
      case "status":
        grantStatus(actor, effect.status, effect.amount, events);
        break;
      case "cleanse":
        removeEffects(actor, "cleanse", effect.amount, events);
        break;
      case "purge":
        if (target) removeEffects(target, "purge", effect.amount, events);
        break;
      case "draw":
        if (!enemy) draw(state, effect.amount);
        break;
      case "mana":
        if (!enemy) state.battle!.mana = Math.min(state.battle!.maxMana, state.battle!.mana + effect.amount);
        break;
    }
  }
}
function finishTurn(draft: GameState, events: GameEvent[]) {
  const battle = draft.battle!;
  // Enemy-phase draws and existing overflow survive into the next player turn.
  battle.discard.push(...battle.hand.splice(0));
  for (let pass = 0; pass < 3; pass++) {
    for (const enemy of battle.enemies) {
      if (enemy.health <= 0) continue;
      tickStatuses(draft, enemy, events);
      if (settle(draft, events)) return;
      enemy.block = Math.round(enemy.block / 2);
      if (!startAction(enemy, events)) continue;
      const target = living(draft).find((c) => c.id === enemy.targetId) ?? living(draft)[0];
      if (!target) break;
      const abilities = CARDS.filter(
        (card) => card.species === enemy.species && card.id !== enemy.lastAbility,
      );
      const def = enemyCard(abilities[Math.floor(random(draft) * abilities.length)]!);
      const value = enemyAbilityValue(enemy, def);
      enemy.lastAbility = def.id;
      events.push({
        kind: "action",
        actorId: enemy.id,
        targetId: target.id,
        text: `${enemy.name} uses ${def.name}.`,
      });
      if (def.effect === "attack")
        hit(draft, enemy, target, value, def.damageType, events, { leech: def.leech });
      else if (def.effect === "heal") {
        const injured = battle.enemies
          .filter((e) => e.health > 0)
          .sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]!;
        restoreHealth(injured, value, events);
      } else {
        for (const unit of def.effect === "teamGuard"
          ? battle.enemies.filter((e) => e.health > 0)
          : [enemy]) {
          const amount = value;
          unit.block = Math.min(1_000_000, unit.block + amount);
          events.push({
            kind: "block",
            targetId: unit.id,
            amount,
            text: `${unit.name} gains ${amount} Block.`,
          });
        }
      }
      applyExtras(draft, enemy, def, events, true, target);
      if (settle(draft, events)) return;
    }
    for (const c of [...draft.team, ...draft.reserves]) {
      if (c.health <= 0) continue;
      tickStatuses(draft, c, events);
      if (settle(draft, events)) return;
    }
    for (const enemy of battle.enemies) restoreHealth(enemy, 1, events);
    for (const c of [...draft.team, ...draft.reserves]) {
      const stats = combat(c);
      if (stats.grace > 0) stats.grace--;
      c.block = Math.round(c.block / 2);
      c.attacked = false;
      startAction(c, events);
    }
    battle.mana = battle.maxMana;
    battle.turn++;
    intents(draft);
    if (
      living(draft).some((c) => !controlled(c)) ||
      draft.reserves.some((c) => c.health > 0 && !controlled(c))
    )
      break;
  }
  draw(draft, TURN_DRAW);
  events.push({ kind: "turn", text: `Turn ${battle.turn}. ${battle.maxMana} Mana restored.` });
}

function reject(state: GameState, reason: string): CommandResult {
  return { accepted: false, state, reason, events: [] };
}
export function dispatch(state: GameState, command: Command): CommandResult {
  return resolve(state, command, true);
}
export function previewCard(state: GameState, cardId: string, targetId?: string): CommandResult {
  return resolve(state, { type: "play", cardId, targetId }, false);
}
function resolve(state: GameState, command: Command, autoEndTurn: boolean): CommandResult {
  const b = state.battle;
  if (
    command.type === "newRun" &&
    (!Number.isSafeInteger(command.seed) || command.seed < 0 || command.seed > 0xffffffff)
  )
    return reject(state, "Choose a valid journey seed.");
  if (command.type === "draft" && (state.phase !== "draft" || !state.unlocked.includes(command.species)))
    return reject(state, "Choose an unlocked starter.");
  if (command.type === "start" && (state.phase !== "draft" || state.selected.length !== 1))
    return reject(state, "Choose one starter first.");
  if ((command.type === "play" || command.type === "endTurn") && (state.phase !== "battle" || !b))
    return reject(state, "There is no active battle.");
  if (command.type === "play") {
    const card = state.cards.find((c) => c.id === command.cardId);
    if (!card || !b!.hand.includes(card.id)) return reject(state, "That card is not in your hand.");
    const actor = state.team.find((c) => c.id === card.ownerId);
    if (!actor || actor.health <= 0) return reject(state, "That creature is knocked out.");
    if (controlled(actor)) return reject(state, "That creature is Stunned or Frozen.");
    const def = definition(card.definitionId);
    if (b!.mana < def.cost) return reject(state, "Not enough mana.");
    if (def.effect === "attack" && !b!.enemies.some((e) => e.id === command.targetId && e.health > 0))
      return reject(state, "Choose a living enemy.");
    if (
      (def.effect === "guard" || def.effect === "heal") &&
      !state.team.some((c) => c.id === command.targetId && c.health > 0)
    )
      return reject(state, "Choose a living ally.");
  }
  if (
    command.type === "visitCampfire" &&
    (state.phase !== "teamSelection" ||
      !state.expedition ||
      state.expedition.step !== 3 ||
      state.expedition.campfireUsed)
  )
    return reject(state, "There is no available Campfire.");
  if (command.type === "rest" && state.phase !== "campfire") return reject(state, "Rest at a Campfire.");
  if (command.type === "newRun" && !["draft", "victory", "defeat"].includes(state.phase))
    return reject(state, "End the current journey first.");
  if (
    command.type === "beginBattle" &&
    (state.phase !== "teamSelection" ||
      (state.expedition && !state.expedition.offers.some((offer) => offer.location === command.destination)))
  )
    return reject(state, "Choose an offered destination before battle.");
  if (
    command.type === "swap" &&
    (!["battle", "teamSelection"].includes(state.phase) ||
      !state.team.some((c) => c.id === command.activeId) ||
      !state.reserves.some((c) => c.id === command.reserve && (state.phase !== "battle" || c.health > 0)) ||
      state.team.some((c) => c.id === command.reserve))
  )
    return reject(state, "Choose an active creature and a reserve.");
  if (
    command.type === "setLineup" &&
    (!["teamSelection", "recruit", "relic", "campfire"].includes(state.phase) ||
      ![...state.team, ...state.reserves].some(
        (c) => c.id === command.activeId && state.lineup.includes(c.id),
      ) ||
      ![...state.team, ...state.reserves].some((c) => c.id === command.reserve) ||
      state.lineup.includes(command.reserve) ||
      state.reward?.outcome === "defeat" ||
      state.reward?.outcome === "victory")
  )
    return reject(state, "Choose a starting creature and a reserve between battles.");
  if (
    command.type === "recruit" &&
    (state.phase !== "recruit" ||
      !state.reward?.recruits.includes(command.species) ||
      (state.roster.length === 5
        ? !command.replace || ![...state.team, ...state.reserves].some((c) => c.id === command.replace)
        : !!command.replace))
  )
    return reject(state, "Choose an offered species and, if full, a creature to release.");
  if (command.type === "skipRecruit" && state.phase !== "recruit")
    return reject(state, "There is no recruitment choice.");
  if (
    command.type === "chooseRelic" &&
    (state.phase !== "relic" ||
      !state.reward?.relics.includes(command.relic) ||
      state.relics.includes(command.relic))
  )
    return reject(state, "Choose an offered relic.");
  if (command.type === "skipRelic" && state.phase !== "relic")
    return reject(state, "There is no relic reward.");
  if (command.type === "buyTalent" && !canBuyTalent(state, command.talentId))
    return reject(state, "That talent is not available.");
  if (
    command.type === "resetTalents" &&
    (!KEYWORDS.includes(command.keyword) || !state.talents.some((id) => id.startsWith(`${command.keyword}.`)))
  )
    return reject(state, "There are no talents to reset in this category.");
  if (
    command.type === "abandon" &&
    !["battle", "teamSelection", "recruit", "relic", "campfire"].includes(state.phase) &&
    !(state.phase === "draft" && state.selected.length > 0)
  )
    return reject(state, "There is no journey to end.");
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    draft.revision++;
    switch (command.type) {
      case "draft": {
        draft.selected = [command.species];
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
        draft.journey = { outcome: null, victories: 0, currency: 0, xp: {}, unlocks: [], lastBattle: null };
        draft.roster = [...draft.selected];
        draft.lineup = draft.team.map((c) => c.id);
        draft.phase = "teamSelection";
        if (draft.expedition) offerDestinations(draft);
        break;
      case "beginBattle":
        if (draft.journey) draft.journey.lastBattle = null;
        if (draft.expedition) draft.expedition.chosen = command.destination!;
        beginBattle(draft);
        events.push({ kind: "turn", text: "Your journey begins." });
        break;
      case "visitCampfire":
        draft.phase = "campfire";
        break;
      case "rest":
        for (const creature of [...draft.team, ...draft.reserves])
          restoreHealth(creature, Math.round(species(creature.species).health * 0.3), events, true);
        draft.expedition!.campfireUsed = true;
        draft.phase = "teamSelection";
        break;
      case "play": {
        const battle = draft.battle!;
        const card = draft.cards.find((c) => c.id === command.cardId)!;
        const def = definition(card.definitionId);
        const actor = draft.team.find((c) => c.id === card.ownerId)!;
        const value = actionValue(card, actor, draft);
        for (const keyword of cardKeywords(card))
          draft.battleXP[keyword] = Math.min(1_000_000, (draft.battleXP[keyword] ?? 0) + 1);
        battle.mana -= def.cost;
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
          hit(draft, actor, enemy, value, def.damageType, events, { leech: def.leech });
          actor.attacked = true;
        }
        if (def.effect === "guard" || def.effect === "teamGuard") {
          const targets =
            def.effect === "teamGuard" ? living(draft) : draft.team.filter((c) => c.id === command.targetId);
          for (const target of targets) {
            target.block = Math.min(1_000_000, target.block + value);
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
        applyExtras(
          draft,
          actor,
          def,
          events,
          false,
          battle.enemies.find((e) => e.id === command.targetId),
        );
        const followups = cardFollowups(card, draft);
        if (actor.health > 0 && followups.block > 0) {
          actor.block = Math.min(1_000_000, actor.block + followups.block);
          events.push({
            kind: "block",
            targetId: actor.id,
            amount: followups.block,
            text: `Acting creature gains ${followups.block} Block.`,
          });
        }
        const restored = Math.min(followups.heal, species(actor.species).health - actor.health);
        if (actor.health > 0 && restored > 0) {
          actor.health += restored;
          events.push({
            kind: "heal",
            targetId: actor.id,
            amount: restored,
            text: `Acting creature restores ${restored} Health.`,
          });
        }
        fillHand(draft);
        if (autoEndTurn) settle(draft, events);
        if (autoEndTurn && draft.phase === "battle" && battle.mana === 0) finishTurn(draft, events);
        break;
      }
      case "endTurn": {
        finishTurn(draft, events);
        break;
      }
      case "setLineup": {
        const outgoing = [...draft.team, ...draft.reserves].find((c) => c.id === command.activeId)!;
        draft.lineup[draft.lineup.indexOf(outgoing.id)] = command.reserve;
        if (draft.phase === "teamSelection" || draft.phase === "campfire") prepareLineup(draft);
        break;
      }
      case "swap": {
        const index = draft.team.findIndex((c) => c.id === command.activeId);
        const reserveIndex = draft.reserves.findIndex((c) => c.id === command.reserve);
        const outgoing = draft.team[index]!;
        const incoming = draft.reserves[reserveIndex]!;
        draft.team[index] = incoming;
        draft.reserves[reserveIndex] = outgoing;
        const oldDefs = CARDS.filter((c) => c.species === outgoing.species);
        const newDefs = CARDS.filter((c) => c.species === incoming.species);
        for (const card of draft.cards.filter((c) => c.ownerId === outgoing.id)) {
          card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
          card.ownerId = incoming.id;
          card.level = 0;
        }
        if (draft.phase === "battle") {
          for (const enemy of draft.battle!.enemies)
            if (enemy.targetId === outgoing.id) enemy.targetId = incoming.id;
        } else {
          draft.lineup = draft.team.map((c) => c.id);
          if (draft.battle)
            for (const enemy of draft.battle.enemies)
              if (enemy.targetId === outgoing.id) enemy.targetId = incoming.id;
        }
        events.push({
          kind: "action",
          actorId: incoming.id,
          text: `${species(incoming.species).name} replaces ${species(outgoing.species).name}.`,
        });
        break;
      }
      case "recruit": {
        if (!draft.discovery.recruited.includes(command.species))
          draft.discovery.recruited.push(command.species);
        const all = [...draft.team, ...draft.reserves];
        let id = `recruit-${draft.revision}`;
        for (let suffix = 1; all.some((creature) => creature.id === id); suffix++)
          id = `recruit-${draft.revision}-${suffix}`;
        const recruited = {
          id,
          species: command.species,
          health: species(command.species).health,
          block: 0,
          attacked: false,
        };
        if (command.replace) {
          const released = [...draft.team, ...draft.reserves].find((c) => c.id === command.replace)!;
          draft.roster[draft.roster.indexOf(released.species)] = command.species;
          draft.lineup = draft.lineup.map((id) => (id === command.replace ? recruited.id : id));
          const index = draft.team.findIndex((c) => c.id === command.replace);
          if (index >= 0) {
            const old = draft.team[index]!;
            draft.team[index] = recruited;
            const oldDefs = CARDS.filter((c) => c.species === old.species);
            const newDefs = CARDS.filter((c) => c.species === command.species);
            for (const card of draft.cards.filter((c) => c.ownerId === old.id)) {
              card.ownerId = recruited.id;
              card.definitionId = newDefs[oldDefs.findIndex((def) => def.id === card.definitionId)]!.id;
              card.level = 0;
            }
            if (draft.battle)
              for (const enemy of draft.battle.enemies)
                if (enemy.targetId === old.id) enemy.targetId = recruited.id;
          } else draft.reserves[draft.reserves.findIndex((c) => c.id === command.replace)] = recruited;
        } else {
          draft.roster.push(command.species);
          if (draft.lineup.length < 3) {
            draft.lineup.push(recruited.id);
            draft.team.push(recruited);
            const cards = ownedCards(recruited.id, recruited.species);
            draft.cards.push(...cards);
            // The settled battle remains a valid receipt through recruitment and relic choice.
            draft.battle?.discard.push(...cards.map((card) => card.id));
          } else draft.reserves.push(recruited);
        }
        afterRewards(draft);
        break;
      }
      case "skipRecruit":
        afterRewards(draft);
        break;
      case "chooseRelic":
        draft.relics.push(command.relic);
        afterRewards(draft);
        break;
      case "skipRelic":
        afterRewards(draft);
        break;
      case "buyTalent":
        draft.talents.push(command.talentId);
        break;
      case "resetTalents":
        draft.talents = draft.talents.filter((id) => !id.startsWith(`${command.keyword}.`));
        break;
      case "newRun": {
        const fresh = createGame(command.seed);
        Object.assign(draft, fresh, {
          revision: state.revision + 1,
          unlocked: [...state.unlocked],
          discovery: {
            encountered: [...state.discovery.encountered],
            recruited: [...state.discovery.recruited],
          },
          wins: state.wins,
          keywordXP: { ...state.keywordXP },
          talents: [...state.talents],
          currency: state.currency,
        });
        break;
      }
      case "abandon":
        if (draft.phase === "draft") {
          draft.selected = [];
          break;
        }
        bankBattleXP(draft);
        if (draft.journey) draft.journey.outcome = "returned";
        draft.reward = null;
        draft.phase = "defeat";
        events.push({ kind: "knockout", text: "You return from the wilds. Discoveries are kept." });
        break;
    }
  });
  return { accepted: true, state: next, events };
}
