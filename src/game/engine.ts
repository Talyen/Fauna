import { executeAbility } from "./combat/abilities";
import { canVisitCampfire, campfireRecovery, canVisitMerchant, canRecruitDestination } from "./destinations";
import saveFormat from "./save-format.json" with { type: "json" };
import { freeze, produce } from "immer";
import {
  collectedSpecies,
  starterCount,
  MAX_CREATURE_STARS,
  KEYWORDS,
  cardKeywords,
  canBuyTalent,
} from "./progression";
import { combat, gainMana, restoreHealth, controlled } from "./combat/index";
import { fillHand } from "./card-zones";
import { actionValue, cardCost } from "./ability-rules";
import { CARDS, SPECIES, definition, species } from "./content";
import { bossEncounter } from "./encounters";
import type { Command, CommandResult, GameEvent, GameState } from "./types";
import { offerStarters, prepareEncounter, beginBattle, bankBattleXP, settle, afterRewards } from "./journey";
import { ownedCards, prepareLineup, swapBackup, swapFromCard } from "./team";
import { finishTurn, livingChorus } from "./combat/turns";

export function createGame(seed = 1): GameState {
  const state: GameState = {
    version: saveFormat.version,
    support: null,
    discovery: { encountered: [], recruited: {} },
    revision: 0,
    rng: seed >>> 0,
    phase: "draft",
    unlocked: SPECIES.map((entry) => entry.id),
    wins: 0,
    selected: [],
    starterOffers: [],
    roster: [],
    reserves: [],
    lineup: [],
    keywordXP: {},
    battleXP: {},
    talents: [],
    currency: 0,
    boons: [],
    reward: null,
    journey: null,
    team: [],
    cards: [],
    encounter: 0,
    expedition: { pack: null, recruit: null, lastRoom: null },
    battle: null,
  };
  offerStarters(state);
  return freeze(state, true);
}

function reject(state: GameState, reason: string): CommandResult {
  return { accepted: false, state, reason, events: [] };
}

const commandTypes = {
  draft: true,
  start: true,
  beginBattle: true,
  setLineup: true,
  swap: true,
  play: true,
  endTurn: true,
  devWinBattle: true,
  visitCampfire: true,
  rest: true,
  leaveCampfire: true,
  enterSupport: true,
  buyBoon: true,
  leaveSupport: true,
  recruit: true,
  recruitDestination: true,
  skipRecruit: true,
  chooseBoon: true,
  skipBoon: true,
  buyTalent: true,
  resetTalents: true,
  newRun: true,
  abandon: true,
} satisfies Record<Command["type"], true>;

export function dispatch(state: GameState, command: Command, development = false): CommandResult {
  if (command.type === "devWinBattle" && !development)
    return reject(state, "Development command unavailable.");
  return resolve(state, command, false);
}

export function previewCard(state: GameState, cardId: string, targetId?: string): CommandResult {
  return resolve(state, { type: "play", cardId, targetId }, true);
}

function resolve(state: GameState, command: Command, preview: boolean): CommandResult {
  if (!Object.hasOwn(commandTypes, command.type)) return reject(state, "Unknown command.");
  const b = state.battle;
  if (
    command.type === "newRun" &&
    (!Number.isSafeInteger(command.seed) || command.seed < 0 || command.seed > 0xffffffff)
  )
    return reject(state, "Choose a valid journey seed.");
  if (
    command.type === "draft" &&
    (state.phase !== "draft" ||
      !state.starterOffers.includes(command.species) ||
      state.selected.length === starterCount(state))
  )
    return reject(state, "Choose an offered starter.");
  if (command.type === "start" && (state.phase !== "draft" || state.selected.length !== starterCount(state)))
    return reject(state, "Complete your starter choices first.");
  if (
    (command.type === "play" || command.type === "endTurn" || command.type === "devWinBattle") &&
    (state.phase !== "battle" || !b)
  )
    return reject(state, "There is no active battle.");
  if (command.type === "play") {
    const card = state.cards.find((c) => c.id === command.cardId);
    if (!card || !b!.hand.includes(card.id)) return reject(state, "That card is not in your hand.");
    const actor = state.team.find((c) => c.id === card.ownerId);
    if (!actor || actor.health <= 0) return reject(state, "That creature is knocked out.");
    if (controlled(actor)) return reject(state, "That creature is Stunned or Frozen.");
    const def = definition(card.definitionId);
    if (b!.mana < cardCost(card, state)) return reject(state, "Not enough mana.");
    if (
      def.effect === "attack" &&
      !def.target &&
      !b!.enemies.some((e) => e.id === command.targetId && e.health > 0)
    )
      return reject(state, "Choose a living enemy.");
    if (
      ((def.effect === "guard" && def.target !== "self") || (def.effect === "heal" && !def.target)) &&
      !state.team.some((c) => c.id === command.targetId && c.health > 0)
    )
      return reject(state, "Choose a living ally.");
    if (
      (def.effect === "dodge" ||
        ((def.effect === "guard" || def.effect === "heal") && def.target === "self")) &&
      command.targetId !== undefined &&
      command.targetId !== actor.id
    )
      return reject(state, "This ability targets its acting creature.");
  }
  if (command.type === "visitCampfire" && !canVisitCampfire(state))
    return reject(state, "There is no available Campfire.");
  if ((command.type === "rest" || command.type === "leaveCampfire") && state.phase !== "campfire")
    return reject(state, "Visit a Campfire first.");
  if (command.type === "newRun" && !["draft", "victory", "defeat"].includes(state.phase))
    return reject(state, "End the current journey first.");
  if (command.type === "beginBattle" && state.phase !== "teamSelection") {
    return reject(state, "Battle is unavailable.");
  }
  if (
    command.type === "swap" &&
    (!["battle", "teamSelection"].includes(state.phase) ||
      !state.team.some((c) => c.id === command.activeId) ||
      !state.reserves.some((c) => c.id === command.reserve && (state.phase !== "battle" || c.health > 0)) ||
      state.team.some((c) => c.id === command.reserve))
  )
    return reject(state, "Choose an active creature and a backup.");
  if (
    command.type === "setLineup" &&
    (!["teamSelection", "recruit", "boon", "campfire", "support"].includes(state.phase) ||
      ![...state.team, ...state.reserves].some(
        (c) => c.id === command.activeId && state.lineup.includes(c.id),
      ) ||
      ![...state.team, ...state.reserves].some((c) => c.id === command.reserve) ||
      state.lineup.includes(command.reserve) ||
      state.reward?.outcome === "defeat" ||
      state.reward?.outcome === "victory")
  )
    return reject(state, "Choose a starting creature and a backup between battles.");
  if (
    command.type === "recruit" &&
    (state.phase !== "recruit" ||
      !state.reward?.recruits.includes(command.species) ||
      (state.roster.length === 5
        ? !command.replace || ![...state.team, ...state.reserves].some((c) => c.id === command.replace)
        : !!command.replace))
  )
    return reject(state, "Choose an offered species and, if full, a creature to release.");
  if (
    command.type === "recruitDestination" &&
    (!canRecruitDestination(state) || state.expedition?.recruit !== command.species)
  )
    return reject(state, "That recruit is unavailable.");
  if (command.type === "skipRecruit" && (state.phase !== "recruit" || !!state.reward?.recruits.length))
    return reject(state, "Choose a creature to recruit.");
  if (
    command.type === "chooseBoon" &&
    (state.phase !== "boon" ||
      !state.reward?.boons.includes(command.boon) ||
      state.boons.includes(command.boon))
  )
    return reject(state, "Choose an offered boon.");
  if (command.type === "skipBoon" && state.phase !== "boon") return reject(state, "There is no boon reward.");
  if (command.type === "buyTalent" && !canBuyTalent(state, command.talentId))
    return reject(state, "That talent is not available.");
  if (
    command.type === "resetTalents" &&
    (!KEYWORDS.includes(command.keyword) || !state.talents.some((id) => id.startsWith(`${command.keyword}.`)))
  )
    return reject(state, "There are no talents to reset in this category.");
  if (
    command.type === "abandon" &&
    !["battle", "teamSelection", "recruit", "boon", "campfire", "support"].includes(state.phase) &&
    !(state.phase === "draft" && state.selected.length > 0)
  )
    return reject(state, "There is no journey to end.");
  const visit = state.support;
  if (command.type === "enterSupport" && (!canVisitMerchant(state) || !visit || visit.id !== command.visit))
    return reject(state, "That visit is unavailable.");
  if (
    ["buyBoon", "leaveSupport"].includes(command.type) &&
    (state.phase !== "support" || !visit || !("visit" in command) || command.visit !== visit.id)
  )
    return reject(state, "That visit is no longer active.");
  if (command.type === "buyBoon") {
    const slot = visit?.stock.find((s) => s.slot === command.slot);
    if (
      visit?.kind !== "merchant" ||
      visit.resolved ||
      visit.purchased ||
      !slot ||
      state.boons.includes(slot.boon) ||
      state.currency < slot.price
    )
      return reject(state, "That purchase is unavailable.");
  }
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    draft.revision++;
    switch (command.type) {
      case "draft": {
        draft.selected.push(command.species);
        offerStarters(draft);
        break;
      }
      case "start":
        if (collectedSpecies(draft).length === 0) {
          for (const kind of draft.selected) draft.discovery.recruited[kind] = 1;
          for (const kind of draft.selected)
            if (!draft.discovery.encountered.includes(kind)) draft.discovery.encountered.push(kind);
        }
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
        if (draft.expedition) prepareEncounter(draft);
        break;
      case "enterSupport":
        draft.phase = "support";
        break;
      case "leaveSupport":
        draft.support!.resolved = true;
        draft.expedition!.lastRoom = "merchant";
        prepareEncounter(draft);
        draft.phase = "teamSelection";
        break;
      case "buyBoon": {
        const slot = draft.support!.stock.find((s) => s.slot === command.slot)!;
        draft.currency -= slot.price;
        draft.boons.push(slot.boon);
        draft.support!.purchased = slot.boon;
        draft.support!.resolved = true;
        events.push({ kind: "reward", text: "Boon purchased for this journey." });
        break;
      }
      case "beginBattle":
        draft.support = null;
        if (draft.expedition) {
          draft.expedition.recruit = null;
          draft.expedition.lastRoom = bossEncounter(draft) ? "boss" : "combat";
        }
        if (draft.journey) draft.journey.lastBattle = null;
        beginBattle(draft, events);
        events.push({ kind: "turn", text: "Your journey begins." });
        break;
      case "visitCampfire":
        draft.phase = "campfire";
        break;
      case "leaveCampfire":
        draft.expedition!.lastRoom = "campfire";
        draft.phase = "teamSelection";
        break;
      case "rest":
        draft.expedition!.lastRoom = "campfire";
        for (const creature of [...draft.team, ...draft.reserves])
          restoreHealth(creature, campfireRecovery(creature), events, true);
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
        battle.mana -= cardCost(card, draft);
        const keywords = cardKeywords(card);
        combat(actor).freeCard = false;
        if (keywords.includes("nature")) combat(actor).freeNature = false;
        if (keywords.includes("light")) combat(actor).freeLight = false;
        if (keywords.includes("burn")) battle.freeBurnUsed = true;
        battle.hand.splice(battle.hand.indexOf(card.id), 1);
        battle.discard.push(card.id);
        executeAbility(
          draft,
          {
            side: "player",
            actor,
            def,
            value,
            targetId: command.targetId,
            allyTargetId: command.targetId,
          },
          events,
          { swap: swapFromCard },
        );
        if (battle.cardsPlayedThisTurn < 3) {
          battle.cardsPlayedThisTurn++;
          if (battle.cardsPlayedThisTurn === 2) livingChorus(draft, false, events);
          if (battle.cardsPlayedThisTurn === 3 && draft.boons.includes("resonant-chimes"))
            gainMana(draft, 1, events);
        }
        fillHand(draft);
        if (!preview) settle(draft, events);
        if (!preview && command.autoEndTurn !== false && draft.phase === "battle" && battle.mana === 0)
          finishTurn(draft, events);
        break;
      }
      case "devWinBattle": {
        for (const enemy of draft.battle!.enemies) enemy.health = 0;
        settle(draft, events);
        break;
      }
      case "endTurn": {
        finishTurn(draft, events);
        break;
      }
      case "setLineup": {
        const outgoing = [...draft.team, ...draft.reserves].find((c) => c.id === command.activeId)!;
        draft.lineup[draft.lineup.indexOf(outgoing.id)] = command.reserve;
        if (["teamSelection", "campfire", "support"].includes(draft.phase)) prepareLineup(draft);
        break;
      }
      case "swap": {
        swapBackup(draft, command.activeId, command.reserve, events);
        break;
      }
      case "recruitDestination":
      case "recruit": {
        const replacement = command.type === "recruit" ? command.replace : undefined;
        if (!draft.discovery.encountered.includes(command.species))
          draft.discovery.encountered.push(command.species);
        draft.discovery.recruited[command.species] = Math.min(
          MAX_CREATURE_STARS + 1,
          (draft.discovery.recruited[command.species] ?? 0) + 1,
        );
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
        if (replacement) {
          const released = [...draft.team, ...draft.reserves].find((c) => c.id === replacement)!;
          draft.roster[draft.roster.indexOf(released.species)] = command.species;
          draft.lineup = draft.lineup.map((id) => (id === replacement ? recruited.id : id));
          const index = draft.team.findIndex((c) => c.id === replacement);
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
          } else draft.reserves[draft.reserves.findIndex((c) => c.id === replacement)] = recruited;
        } else {
          draft.roster.push(command.species);
          if (draft.lineup.length < 3) {
            draft.lineup.push(recruited.id);
            draft.team.push(recruited);
            const cards = ownedCards(recruited.id, recruited.species);
            draft.cards.push(...cards);
            // The settled battle remains a valid receipt through recruitment and boon choice.
            draft.battle?.discard.push(...cards.map((card) => card.id));
          } else draft.reserves.push(recruited);
        }
        if (command.type === "recruitDestination") {
          draft.expedition!.recruit = null;
          draft.expedition!.lastRoom = "recruit";
          events.push({ kind: "reward", text: `${species(command.species).name} joined your roster.` });
        } else afterRewards(draft);
        break;
      }
      case "skipRecruit":
        afterRewards(draft);
        break;
      case "chooseBoon":
        draft.boons.push(command.boon);
        afterRewards(draft);
        break;
      case "skipBoon":
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
          rng: command.seed >>> 0,
          unlocked: [...state.unlocked],
          discovery: {
            encountered: [...state.discovery.encountered],
            recruited: { ...state.discovery.recruited },
          },
          wins: state.wins,
          keywordXP: { ...state.keywordXP },
          talents: [...state.talents],
          currency: state.currency,
        });
        offerStarters(draft);
        break;
      }
      case "abandon":
        draft.support = null;
        if (draft.expedition) draft.expedition.recruit = null;
        if (draft.phase === "draft") {
          draft.selected = [];
          offerStarters(draft);
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
  return { accepted: true, state: next, events: freeze(events, true) };
}
