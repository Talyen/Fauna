import { isFood } from "./content/food";
import { unfinishedJourneyLimit } from "./card-actors";
import { PEARL } from "./content/creatures/memento";
import { battlefield } from "./battlefield";
import { needsCampfire, merchantPriceRange } from "./destinations";
import { freeze } from "immer";
import { MAX_HAND_SIZE } from "./card-zones";
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

export function decodeSave(raw: string): GameState {
  if (raw.length > 100_000) throw new Error("Save exceeds the supported size.");
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
  invalid(!unique(state.discovery.encountered) || !unique(state.boons));
  invalid(
    SPECIES.some(
      ({ id }) => state.discovery.recruited[id] !== undefined && !state.discovery.encountered.includes(id),
    ),
  );
  const starterPool = starterSpecies(state);
  const offerPool = starterOfferPool(state);
  const drafting = state.phase === "draft" && state.selected.length < starterCount(state);
  invalid(
    new Set(state.starterOffers).size !== (drafting ? Math.min(STARTER_OFFER_COUNT, offerPool.length) : 0) ||
      state.starterOffers.some((kind) => !offerPool.includes(kind)) ||
      state.starterOffers.length !== (drafting ? STARTER_OFFER_COUNT : 0),
  );
  invalid(
    state.selected.some((kind) => !starterPool.includes(kind)) ||
      (state.phase === "draft" && state.selected.length > starterCount(state)) ||
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
  invalid(
    !unique([...state.team, ...state.reserves].map((c) => c.id)) || !unique(state.cards.map((c) => c.id)),
  );
  invalid(state.team.length + state.reserves.length > 5);
  invalid([...state.team, ...state.reserves].some((creature) => !collected.includes(creature.species)));
  invalid([...state.team, ...state.reserves].some((c) => c.health > species(c.species).health));
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

  let expectedPermanentCards = 0;
  for (const creature of state.team) {
    const copies = species(creature.species).legendary ? 2 : 1;
    for (const def of speciesCards(creature.species)) {
      expectedPermanentCards += copies;
      invalid(
        permanentCards.filter((c) => c.ownerId === creature.id && c.definitionId === def.id).length !==
          copies,
      );
    }
  }
  invalid(!validTalentSelection(state));
  if (state.phase === "draft")
    invalid(state.team.length !== 0 || state.cards.length !== 0 || state.reserves.length !== 0);
  else invalid(state.team.length < 1 || permanentCards.length !== expectedPermanentCards);
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
            state.discovery.recruited[selected] === undefined,
        );
    }
    if (state.phase === "boon") invalid(reward.boons.some((r) => state.boons.includes(r)));
    if (reward.outcome === "defeat") invalid([...state.team, ...state.reserves].some((c) => c.health > 0));
  }
}

function validateBattle(state: BattleState) {
  const battle = state.battle,
    source = encounterSource(state);
  invalid(battle.enemies.length !== source.enemies.length || !unique(battle.enemies.map((e) => e.id)));
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
        (!battlefield(state, "player").some((c) => c.id === enemy.targetId) &&
          !state.team.some((c) => c.id === enemy.targetId)),
    );
  });
  const zones = [...battle.draw, ...battle.hand, ...battle.buffer, ...battle.discard];
  // The current turn capacity survives a category reset.
  invalid(
    battle.mana > battle.maxMana ||
      battle.earnedGold > state.currency ||
      battle.earnedGold > state.journey.currency,
  );
  invalid(!unique(zones) || zones.some((id) => !state.cards.some((c) => c.id === id)));
  invalid([...state.team, ...state.reserves].some((creature) => !creature.combat));
  invalid(
    ![...state.team, ...state.reserves].some((c) => c.health > 0) ||
      !battle.enemies.some((e) => e.health > 0) ||
      (battle.buffer.length > 0 && battle.hand.length < MAX_HAND_SIZE) ||
      zones.length !== state.cards.length ||
      state.cards.some((c) => !zones.includes(c.id)),
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
      const defs = speciesCards(enemy.species);
      invalid(
        zones.length !== 6 + deck.pearls ||
          zones.filter((id) => id === PEARL.id).length !== deck.pearls ||
          (deck.buffer.length > 0 && deck.hand.length < MAX_HAND_SIZE),
      );
      for (const def of defs) invalid(zones.filter((id) => id === def.id).length !== 2);
      invalid(zones.some((id) => id !== PEARL.id && !defs.some((def) => def.id === id)));
    }
  }
}

function validateMinions(state: BattleState) {
  for (const unit of state.battle.minions ?? []) {
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
    invalid(
      (state.battle.minions ?? []).filter((other) => other.minion.ownerId === unit.minion.ownerId).length > 2,
    );
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
  invalid(!unique(allCombatants.map((unit) => unit.id)));
  for (const unit of allCombatants)
    if (unit.combat) {
      const stats = unit.combat;
      invalid(
        stats.fallenCardsPlayedThisTurn >
          unfinishedJourneyLimit("maxHealth" in unit ? undefined : state, unit),
      );
      invalid((stats.controlled === null) !== (stats.controlTurns === 0));
      invalid((stats.grace > 0 && !stats.deathDoorUsed) || (stats.controlled !== null && stats.cooldown > 0));
      invalid(
        Object.values(stats.statusSources).some((id) => !allCombatants.some((unit) => unit.id === id)) ||
          stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0) > stats.bleed ||
          stats.bleedLeech.some((row) => !allCombatants.some((source) => source.id === row.sourceId)),
      );
    }
}
