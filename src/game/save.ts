import saveFormat from "./save-format.json" with { type: "json" };
import { matchesPermanentKit } from "./card-kit";
import { isFood } from "./content/food";
import { manaCapacity, encoreProgressLimit, puzzleProgressLimit, metronomeActorValid } from "./ability-rules";
import { unfinishedJourneyLimit } from "./card-actors";
import { PEARL } from "./content/creatures/memento";
import { battlefield } from "./battlefield";
import { needsCampfire, merchantPriceRange } from "./destinations";
import { freeze } from "immer";
import { MAX_BATTLE_CARDS, MAX_HAND_SIZE, handCapacity } from "./card-zones";
import {
  starterCount,
  starterSpecies,
  starterOfferPool,
  STARTER_OFFER_COUNT,
  KEYWORDS,
  validTalentSelection,
} from "./progression";
import { gameStateSchema } from "./state-schema";
import { speciesCards, SPECIES, species } from "./content";
import { encounterSource, finalEncounter, bossEncounter } from "./encounters";
import type { BattleState, GameState } from "./types";
function unique(values: readonly unknown[]) {
  if (values.length < 2) return true;
  const seen = new Set<unknown>();
  for (const value of values) {
    if (seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}
function uniqueBy<T>(values: readonly T[], key: (value: T) => unknown) {
  if (values.length < 2) return true;
  const seen = new Set<unknown>();
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
function invalid(condition: boolean) {
  if (condition) throw new Error("Save contains inconsistent game data.");
}

function utf8Size(text: string) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function decodeSave(raw: string): GameState {
  // Each UTF-16 code unit contributes at most three UTF-8 bytes.
  if (
    raw.length > saveFormat.maxBytes ||
    (raw.length > Math.floor(saveFormat.maxBytes / 3) && utf8Size(raw) > saveFormat.maxBytes)
  )
    throw new Error("Save exceeds the supported size.");
  const state = gameStateSchema.parse(JSON.parse(raw));
  validateCollection(state);
  validateJourney(state);
  validateExpedition(state);
  validateRoster(state);
  validateSupport(state);
  validateRewards(state);
  if (state.phase === "battle") validateBattle(state);
  validateCombatants(state);
  return freeze(state, true);
}

export function encodeSave(state: GameState) {
  return JSON.stringify(state);
}

function validateCollection(state: GameState) {
  const encountered = new Set(state.discovery.encountered);
  invalid(encountered.size !== state.discovery.encountered.length || !unique(state.boons));
  invalid(state.phase === "draft" && state.boons.length > 0);
  invalid(SPECIES.some(({ id }) => state.discovery.recruited[id] !== undefined && !encountered.has(id)));
  const starterPool = state.selected.length ? starterSpecies(state) : [];
  const count = state.phase === "draft" ? starterCount(state) : 0;
  const drafting = state.phase === "draft" && state.selected.length < count;
  const offerPool = drafting ? starterOfferPool(state) : [];
  invalid(
    state.starterOffers.length !== (drafting ? Math.min(STARTER_OFFER_COUNT, offerPool.length) : 0) ||
      !unique(state.starterOffers) ||
      state.starterOffers.some((kind) => !offerPool.includes(kind)),
  );
  invalid(
    !unique(state.selected) ||
      state.selected.some((kind) => !starterPool.includes(kind)) ||
      (state.phase === "draft" && state.selected.length > count) ||
      (state.phase !== "draft" && !SPECIES.some(({ id }) => state.discovery.recruited[id] !== undefined)),
  );
}

function validateJourney(state: GameState) {
  if (state.journey) {
    const summary = state.journey;
    invalid(KEYWORDS.some((keyword) => (summary.xp[keyword] ?? 0) > (state.keywordXP[keyword] ?? 0)));
    const receipt = summary.lastBattle;
    const justWon = receipt?.encounter === state.encounter && receipt.outcome !== "defeat";
    invalid(summary.victories !== state.encounter + Number(justWon));
    if (receipt)
      invalid(
        receipt.encounter > state.encounter ||
          receipt.encounter < state.encounter - 1 ||
          state.phase === "battle" ||
          (receipt.encounter === state.encounter - 1 && receipt.outcome !== "next") ||
          (receipt.outcome === "victory" &&
            !["victory", "recruit", "boon"].includes(state.phase) &&
            !(
              state.phase === "defeat" &&
              summary.outcome === "returned" &&
              finalEncounter(state) &&
              state.wins > 0
            )) ||
          (receipt.outcome === "defeat" && (state.phase !== "defeat" || state.journey.outcome !== "defeat")),
      );
    if (receipt)
      invalid(
        receipt.currency > summary.currency ||
          KEYWORDS.some((keyword) => (receipt.xp[keyword] ?? 0) > (summary.xp[keyword] ?? 0)),
      );
  }
  invalid(state.phase === "victory" && (!finalEncounter(state) || state.wins === 0));
  if (state.phase !== "battle") invalid(Object.values(state.battleXP).some((n) => n !== 0));
}

function validateExpedition(state: GameState) {
  const route = state.expedition;
  if (state.phase === "draft")
    invalid(
      route.pack !== null || route.recruit !== null || route.lastRoom !== null || state.encounter !== 0,
    );
  else {
    const boss = bossEncounter(state);
    invalid(
      route.pack === null ||
        route.pack.length !== (boss ? 1 : Math.min(3, state.encounter + 1)) ||
        (!boss && route.pack.some((kind) => species(kind).legendary)),
    );
  }
  if (route.recruit !== null)
    invalid(
      species(route.recruit).legendary === true ||
        state.team.length + state.reserves.length >= 5 ||
        !["teamSelection", "support", "campfire"].includes(state.phase),
    );
}

const cardIdsBySpecies = new Map<string, ReadonlySet<string>>();

function validateRoster(state: GameState) {
  const roster = [...state.team, ...state.reserves];
  invalid(!uniqueBy(roster, (c) => c.id) || !uniqueBy(state.cards, (c) => c.id));
  invalid(state.team.length + state.reserves.length > 5);
  invalid(
    state.phase !== "draft" &&
      !(state.phase === "defeat" && state.journey.outcome === "defeat") &&
      !roster.some((unit) => unit.health > 0),
  );
  // Reserve battle-generated identities before a destination can create those combatants.
  invalid(roster.some((unit) => /^(?:enemy-|echo-)/.test(unit.id)));
  invalid(!uniqueBy(roster, (creature) => creature.species));
  invalid(roster.some((creature) => state.discovery.recruited[creature.species] === undefined));
  invalid(roster.some((c) => c.health > species(c.species).health));
  const teamById = new Map<string, (typeof state.team)[number]>();
  for (const unit of state.team) teamById.set(unit.id, unit);
  invalid(
    state.cards.some((card) => {
      if (card.ownerId === null) return !(card.temporary && card.level === 0 && isFood(card.definitionId));
      const owner = teamById.get(card.ownerId);
      if (!owner) return true;
      let ids = cardIdsBySpecies.get(owner.species);
      if (!ids) {
        ids = new Set();
        for (const definition of speciesCards(owner.species)) ids.add(definition.id);
        cardIdsBySpecies.set(owner.species, ids);
      }
      return (
        !ids.has(card.definitionId) &&
        !(card.temporary && card.definitionId === PEARL.id && owner.species === "memento")
      );
    }),
  );
  invalid(
    state.cards.some(
      (card) =>
        card.temporary &&
        (state.phase !== "battle" ||
          !/^copy-(0|[1-9]\d*)$/.test(card.id) ||
          Number(card.id.slice(5)) >= state.battle.copySerial),
    ),
  );
  const kits = new Map<string, string[]>();
  for (const card of state.cards) {
    if (card.temporary) continue;
    invalid(card.id.startsWith("copy-"));
    if (card.ownerId === null) continue;
    const ids = kits.get(card.ownerId) ?? [];
    ids.push(card.definitionId);
    kits.set(card.ownerId, ids);
  }
  for (const creature of state.team)
    invalid(!matchesPermanentKit(creature.species, kits.get(creature.id) ?? []));
  invalid(!validTalentSelection(state));
  if (state.phase === "draft")
    invalid(state.team.length !== 0 || state.cards.length !== 0 || state.reserves.length !== 0);
  else invalid(state.team.length < 1);
  invalid(state.team.length !== 1 && state.team.some((unit) => species(unit.species).legendary));
  invalid(state.selected.length !== 1 && state.selected.some((kind) => species(kind).legendary));
}

function validateSupport(state: GameState) {
  if (state.support) {
    const visit = state.support;
    // Stock keeps its original price when this visit sells Merchant's Favor.
    const prices = merchantPriceRange({
      boons: visit.purchased === null ? state.boons : state.boons.filter((boon) => boon !== visit.purchased),
    });
    invalid(
      visit.encounter !== state.encounter ||
        visit.id !== `support-${visit.encounter}` ||
        !visit.stock.length ||
        !uniqueBy(visit.stock, (r) => r.slot) ||
        !uniqueBy(visit.stock, (r) => r.boon) ||
        visit.stock.some(
          (r, i) =>
            r.slot !== `slot-${i}` ||
            r.price < prices.min ||
            r.price > prices.max ||
            (state.boons.includes(r.boon) && visit.purchased !== r.boon),
        ) ||
        (visit.purchased !== null &&
          (!visit.resolved ||
            !state.boons.includes(visit.purchased) ||
            !visit.stock.some((r) => r.boon === visit.purchased))),
    );
  }
  if (state.phase === "campfire") invalid(state.expedition.lastRoom === "campfire" || !needsCampfire(state));
}

function validateRewards(state: GameState) {
  if (state.reward) {
    const reward = state.reward;
    const receipt = state.journey?.lastBattle;
    invalid(
      !receipt ||
        receipt.encounter !== state.encounter ||
        receipt.outcome !== reward.outcome ||
        receipt.currency !== reward.currency ||
        KEYWORDS.some((keyword) => (receipt.xp[keyword] ?? 0) !== (reward.xp[keyword] ?? 0)),
    );
    invalid((!bossEncounter(state) || finalEncounter(state)) && reward.boons.length > 0);
    const enemies = reward.recruits.length || state.phase === "recruit" ? encounterSource(state).enemies : [];
    invalid(
      !unique(reward.boons) ||
        reward.boons.some((boon) => state.boons.includes(boon)) ||
        (reward.recruits.length > 0 &&
          (reward.recruits.length !== enemies.length ||
            reward.recruits.some((kind, index) => kind !== enemies[index]?.species))),
    );
    invalid(
      (reward.outcome === "next" && finalEncounter(state)) ||
        (reward.outcome === "victory" && !finalEncounter(state)),
    );
    if (state.phase === "recruit") {
      invalid(reward.recruits.length !== enemies.length);
      const selected = state.reward.selectedRecruit;
      if (selected !== undefined)
        invalid(
          state.team.length + state.reserves.length !== 5 ||
            !reward.recruits.includes(selected) ||
            state.team.some((unit) => unit.species === selected) ||
            state.reserves.some((unit) => unit.species === selected) ||
            state.discovery.recruited[selected] === undefined,
        );
    }
    if (reward.outcome === "defeat")
      invalid(state.team.some((c) => c.health > 0) || state.reserves.some((c) => c.health > 0));
  }
}

function validateBattle(state: BattleState) {
  const battle = state.battle,
    source = encounterSource(state);
  invalid(!metronomeActorValid(state));
  invalid(battle.encoreProgress > encoreProgressLimit(state));
  invalid(!unique(battle.puzzleProgress) || battle.puzzleProgress.length > puzzleProgressLimit(state));
  invalid(battle.enemies.length !== source.enemies.length || !uniqueBy(battle.enemies, (e) => e.id));
  const playerField = battlefield(state, "player");
  battle.enemies.forEach((enemy) => {
    const index = Number(enemy.id.replace(/^enemy-/, ""));
    const original = source.enemies[index];
    invalid(
      !original ||
        enemy.id !== `enemy-${index}` ||
        enemy.species !== original.species ||
        enemy.name !== original.name ||
        enemy.maxHealth !== original.health ||
        enemy.power !== original.power ||
        enemy.health > enemy.maxHealth ||
        (enemy.lastAbility !== null &&
          !speciesCards(enemy.species).some((card) => card.id === enemy.lastAbility) &&
          !(
            unfinishedJourneyLimit(undefined, enemy) > 0 &&
            battle.enemies.some((owner) =>
              speciesCards(owner.species).some((card) => card.id === enemy.lastAbility),
            )
          )) ||
        enemy.combat.deathDoorUsed ||
        enemy.combat.grace > 0 ||
        !playerField.some((c) => c.id === enemy.targetId),
    );
  });
  const zoneIds = new Set<string>();
  const cardIds = new Set<string>();
  for (const card of state.cards) cardIds.add(card.id);
  let zoneCount = 0;
  let unknownZoneCard = false;
  for (const zone of [battle.draw, battle.hand, battle.buffer, battle.discard]) {
    zoneCount += zone.length;
    for (const id of zone) {
      zoneIds.add(id);
      if (!cardIds.has(id)) unknownZoneCard = true;
    }
  }
  // The current turn capacity survives a category reset.
  invalid(
    battle.mana > manaCapacity(state) ||
      battle.earnedGold > state.currency ||
      battle.earnedGold > state.journey.currency,
  );
  // Unique zones containing only known IDs and matching the unique card count cover every card.
  invalid(zoneIds.size !== zoneCount || unknownZoneCard);
  const roster = [...state.team, ...state.reserves];
  const capacity = handCapacity(state);
  invalid(roster.some((creature) => !creature.combat));
  invalid(
    !roster.some((c) => c.health > 0) ||
      !battle.enemies.some((e) => e.health > 0) ||
      battle.hand.length > capacity ||
      (battle.buffer.length > 0 && battle.hand.length < capacity) ||
      zoneCount !== state.cards.length,
  );
  validateEnemyDecks(state);
  validateMinions(state);
}

function validateEnemyDecks(state: BattleState) {
  for (const enemy of state.battle.enemies) {
    invalid(!!species(enemy.species).legendary !== !!enemy.deck);
    if (enemy.deck) {
      const deck = enemy.deck;
      const kit: string[] = [];
      let pearls = 0;
      let zoneCount = 0;
      for (const zone of [deck.draw, deck.hand, deck.buffer, deck.discard]) {
        zoneCount += zone.length;
        for (const id of zone) {
          if (id === PEARL.id) pearls++;
          else kit.push(id);
        }
      }
      invalid(
        zoneCount > MAX_BATTLE_CARDS ||
          pearls !== deck.pearls ||
          !matchesPermanentKit(enemy.species, kit) ||
          (deck.buffer.length > 0 && deck.hand.length < MAX_HAND_SIZE),
      );
    }
  }
}

function validateMinions(state: BattleState) {
  const minions = state.battle.minions ?? [];
  const counts = minions.length > 2 ? new Map<string, number>() : undefined;
  if (counts)
    for (const unit of minions) counts.set(unit.minion.ownerId, (counts.get(unit.minion.ownerId) ?? 0) + 1);
  for (const unit of minions) {
    const owner =
      unit.minion.side === "player"
        ? (state.team.find((entry) => entry.id === unit.minion.ownerId) ??
          state.reserves.find((entry) => entry.id === unit.minion.ownerId))
        : state.battle.enemies.find((entry) => entry.id === unit.minion.ownerId);
    invalid(
      !owner ||
        owner.species !== "memento" ||
        unit.health > unit.maxHealth ||
        ![6, 8, 10, 12].includes(unit.maxHealth) ||
        (unit.id !== `echo-${unit.minion.ownerId}-0` && unit.id !== `echo-${unit.minion.ownerId}-1`) ||
        unit.combat.deathDoorUsed ||
        unit.combat.grace > 0,
    );
    invalid((counts?.get(unit.minion.ownerId) ?? 0) > 2);
    invalid(
      unit.health > 0 &&
        (!owner ||
          owner.health === 0 ||
          (unit.minion.side === "player" && !state.team.some((entry) => entry.id === owner.id))),
    );
  }
}

function validateCombatants(state: GameState) {
  const allCombatants = [
    ...state.team,
    ...state.reserves,
    ...(state.battle?.enemies ?? []),
    ...(state.battle?.minions ?? []),
  ];
  const combatantIds = new Set<string>();
  for (const unit of allCombatants) combatantIds.add(unit.id);
  invalid(combatantIds.size !== allCombatants.length);
  for (const unit of allCombatants)
    if (unit.combat) {
      const stats = unit.combat;
      invalid(
        stats.fallenCardsPlayedThisTurn >
          unfinishedJourneyLimit("maxHealth" in unit ? undefined : state, unit),
      );
      invalid((stats.controlled === null) !== (stats.controlTurns === 0));
      invalid(stats.controlled !== null && stats[stats.controlled] !== 0);
      invalid((stats.grace > 0 && !stats.deathDoorUsed) || (stats.controlled !== null && stats.cooldown > 0));
      invalid(Object.values(stats.statusSources).some((id) => !combatantIds.has(id)));
      if (stats.bleedLeech.length) {
        const sources = new Set<string>();
        let total = 0;
        for (const row of stats.bleedLeech) {
          invalid(sources.has(row.sourceId) || row.amount === 0 || !combatantIds.has(row.sourceId));
          sources.add(row.sourceId);
          total += row.amount;
        }
        invalid(total > stats.bleed);
      }
    }
}
