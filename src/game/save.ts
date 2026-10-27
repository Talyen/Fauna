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
  collectedSpecies,
  KEYWORDS,
  validTalentSelection,
} from "./progression";
import { gameStateSchema } from "./state-schema";
import { speciesCards, SPECIES, species } from "./content";
import { encounterSource, finalEncounter, bossEncounter } from "./encounters";
import type { BattleState, GameState } from "./types";
const unique = (values: readonly unknown[]) => new Set(values).size === values.length;
function invalid(condition: boolean) {
  if (condition) throw new Error("Save contains inconsistent game data.");
}

function utf8Size(text: string) {
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function decodeSave(raw: string): GameState {
  if (raw.length > saveFormat.maxBytes || utf8Size(raw) > saveFormat.maxBytes)
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
  const starterPool = starterSpecies(state);
  const offerPool = starterOfferPool(state);
  const count = state.phase === "draft" ? starterCount(state) : 0;
  const drafting = state.phase === "draft" && state.selected.length < count;
  invalid(
    new Set(state.starterOffers).size !== (drafting ? Math.min(STARTER_OFFER_COUNT, offerPool.length) : 0) ||
      state.starterOffers.some((kind) => !offerPool.includes(kind)) ||
      state.starterOffers.length !== (drafting ? Math.min(STARTER_OFFER_COUNT, offerPool.length) : 0),
  );
  invalid(
    !unique(state.selected) ||
      state.selected.some((kind) => !starterPool.includes(kind)) ||
      (state.phase === "draft" && state.selected.length > count) ||
      (state.phase !== "draft" && !collectedSpecies(state).length),
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
  else
    invalid(
      route.pack === null ||
        route.pack.length !== (bossEncounter(state) ? 1 : Math.min(3, state.encounter + 1)) ||
        route.pack.some((kind) => species(kind).legendary && !bossEncounter(state)),
    );
  if (route.recruit !== null)
    invalid(
      species(route.recruit).legendary === true ||
        state.team.length + state.reserves.length >= 5 ||
        !["teamSelection", "support", "campfire"].includes(state.phase),
    );
}

function validateRoster(state: GameState) {
  const collected = collectedSpecies(state);
  const roster = [...state.team, ...state.reserves];
  invalid(!unique(roster.map((c) => c.id)) || !unique(state.cards.map((c) => c.id)));
  invalid(state.team.length + state.reserves.length > 5);
  invalid(
    state.phase !== "draft" &&
      !(state.phase === "defeat" && state.journey.outcome === "defeat") &&
      !roster.some((unit) => unit.health > 0),
  );
  // Reserve battle-generated identities before a destination can create those combatants.
  invalid(roster.some((unit) => /^(?:enemy-|echo-)/.test(unit.id)));
  invalid(!unique(roster.map((creature) => creature.species)));
  invalid(roster.some((creature) => !collected.includes(creature.species)));
  invalid(roster.some((c) => c.health > species(c.species).health));
  invalid(
    state.cards.some((c) =>
      c.ownerId === null
        ? !(c.temporary && c.level === 0 && isFood(c.definitionId))
        : !state.team.some(
            (t) =>
              t.id === c.ownerId &&
              (speciesCards(t.species).some((d) => d.id === c.definitionId) ||
                (c.temporary && c.definitionId === PEARL.id && t.species === "memento")),
          ),
    ),
  );
  const permanentCards = state.cards.filter((card) => !card.temporary);
  invalid(
    state.cards.some(
      (card) =>
        card.temporary &&
        (state.phase !== "battle" ||
          !/^copy-(0|[1-9]\d*)$/.test(card.id) ||
          Number(card.id.slice(5)) >= state.battle.copySerial),
    ),
  );
  invalid(permanentCards.some((card) => card.id.startsWith("copy-")));

  const kits = new Map<string, string[]>();
  for (const card of permanentCards) {
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
  invalid(state.team.some((unit) => species(unit.species).legendary) && state.team.length !== 1);
  invalid(state.selected.some((kind) => species(kind).legendary) && state.selected.length !== 1);
}

function validateSupport(state: GameState) {
  if (state.support) {
    const visit = state.support;
    // Stock keeps its original price when this visit sells Merchant's Favor.
    const prices = merchantPriceRange({ boons: state.boons.filter((boon) => boon !== visit.purchased) });
    invalid(
      visit.encounter !== state.encounter ||
        visit.id !== `support-${visit.encounter}` ||
        !visit.stock.length ||
        !unique(visit.stock.map((r) => r.slot)) ||
        !unique(visit.stock.map((r) => r.boon)) ||
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
    const enemies = encounterSource(state).enemies;
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
            [...state.team, ...state.reserves].some((unit) => unit.species === selected) ||
            state.discovery.recruited[selected] === undefined,
        );
    }
    if (reward.outcome === "defeat") invalid([...state.team, ...state.reserves].some((c) => c.health > 0));
  }
}

function validateBattle(state: BattleState) {
  const battle = state.battle,
    source = encounterSource(state);
  invalid(!metronomeActorValid(state));
  invalid(battle.encoreProgress > encoreProgressLimit(state));
  invalid(!unique(battle.puzzleProgress) || battle.puzzleProgress.length > puzzleProgressLimit(state));
  invalid(battle.enemies.length !== source.enemies.length || !unique(battle.enemies.map((e) => e.id)));
  const playerField = battlefield(state, "player");
  battle.enemies.forEach((enemy) => {
    const original = source.enemies[Number(enemy.id.replace(/^enemy-/, ""))];
    invalid(
      !original ||
        !source.enemies.some((_, index) => enemy.id === `enemy-${index}`) ||
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
        (!playerField.some((c) => c.id === enemy.targetId) &&
          !state.team.some((c) => c.id === enemy.targetId)),
    );
  });
  const zones = [...battle.draw, ...battle.hand, ...battle.buffer, ...battle.discard];
  const zoneIds = new Set(zones);
  const cardIds = new Set(state.cards.map((card) => card.id));
  // The current turn capacity survives a category reset.
  invalid(
    battle.mana > manaCapacity(state) ||
      battle.earnedGold > state.currency ||
      battle.earnedGold > state.journey.currency,
  );
  invalid(zoneIds.size !== zones.length || zones.some((id) => !cardIds.has(id)));
  invalid([...state.team, ...state.reserves].some((creature) => !creature.combat));
  invalid(
    ![...state.team, ...state.reserves].some((c) => c.health > 0) ||
      !battle.enemies.some((e) => e.health > 0) ||
      battle.hand.length > handCapacity(state) ||
      (battle.buffer.length > 0 && battle.hand.length < handCapacity(state)) ||
      zones.length !== state.cards.length ||
      state.cards.some((c) => !zoneIds.has(c.id)),
  );
  validateEnemyDecks(state);
  validateMinions(state);
}

function validateEnemyDecks(state: BattleState) {
  for (const enemy of state.battle.enemies) {
    invalid(!!species(enemy.species).legendary !== !!enemy.deck);
    if (enemy.deck) {
      const deck = enemy.deck;
      const zones = [...deck.draw, ...deck.hand, ...deck.buffer, ...deck.discard];
      const kit: string[] = [];
      let pearls = 0;
      for (const id of zones) {
        if (id === PEARL.id) pearls++;
        else kit.push(id);
      }
      invalid(
        zones.length > MAX_BATTLE_CARDS ||
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
    const owners = unit.minion.side === "player" ? [...state.team, ...state.reserves] : state.battle.enemies;
    const owner = owners.find((entry) => entry.id === unit.minion.ownerId);
    invalid(
      !owner ||
        owner.species !== "memento" ||
        unit.health > unit.maxHealth ||
        ![6, 8, 10, 12].includes(unit.maxHealth) ||
        ![0, 1].some((slot) => unit.id === `echo-${unit.minion.ownerId}-${slot}`) ||
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
  const combatantIds = new Set(allCombatants.map((unit) => unit.id));
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
      invalid(
        Object.values(stats.statusSources).some((id) => !combatantIds.has(id)) ||
          !unique(stats.bleedLeech.map((row) => row.sourceId)) ||
          stats.bleedLeech.some((row) => row.amount === 0) ||
          stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0) > stats.bleed ||
          stats.bleedLeech.some((row) => !combatantIds.has(row.sourceId)),
      );
    }
}
