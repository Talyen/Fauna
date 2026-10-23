import { PEARL } from "./content/creatures/memento";
import { battlefield } from "./battlefield";
import { ownedCards } from "./team";
import { needsCampfire, merchantPriceRange } from "./destinations";
import { freeze } from "immer";
import { MAX_HAND_SIZE } from "./card-zones";
import { starterCount, collectedSpecies, KEYWORDS, talentPoints } from "./progression";
import { gameStateSchema } from "./state-schema";
import { CARDS, SPECIES, FIRST_RUN_STARTERS, species, TALENTS } from "./content";
import { encounterSource, finalEncounter, bossEncounter } from "./encounters";
import type { GameState } from "./types";
const unique = (values: unknown[]) => new Set(values).size === values.length;
export function decodeSave(raw: string): GameState {
  if (raw.length > 100_000) throw new Error("Save exceeds the supported size.");
  const s = gameStateSchema.parse(JSON.parse(raw));
  const invalid = (condition: boolean) => {
    if (condition) throw new Error("Save contains inconsistent game data.");
  };
  invalid(!unique(s.discovery.encountered));
  invalid(
    SPECIES.some(
      ({ id }) => s.discovery.recruited[id] !== undefined && !s.discovery.encountered.includes(id),
    ),
  );
  const collected = collectedSpecies(s);
  const starterPool = collected.length ? collected : FIRST_RUN_STARTERS;
  const offerPool = starterPool.filter((kind) => !s.selected.length || !species(kind).legendary);
  const drafting = s.phase === "draft" && s.selected.length < starterCount(s);
  invalid(
    new Set(s.starterOffers).size !== (drafting ? Math.min(3, offerPool.length) : 0) ||
      s.starterOffers.some((kind) => !offerPool.includes(kind)) ||
      s.starterOffers.length !== (drafting ? 3 : 0),
  );
  if (s.journey) {
    const summary = s.journey;
    invalid(!unique(summary.unlocks) || summary.unlocks.some((kind) => !s.unlocked.includes(kind)));
    invalid(KEYWORDS.some((keyword) => (summary.xp[keyword] ?? 0) > (s.keywordXP[keyword] ?? 0)));
    const receipt = summary.lastBattle;
    const justWon = receipt?.encounter === s.encounter && receipt.outcome !== "defeat";
    invalid(summary.victories !== s.encounter + Number(justWon));
    if (receipt)
      invalid(
        receipt.encounter > s.encounter ||
          receipt.encounter < s.encounter - 1 ||
          s.phase === "battle" ||
          (receipt.encounter === s.encounter - 1 && receipt.outcome !== "next") ||
          (receipt.outcome === "victory" &&
            !["victory", "recruit", "boon"].includes(s.phase) &&
            !(s.phase === "defeat" && summary.outcome === "returned" && finalEncounter(s) && s.wins > 0)) ||
          (receipt.outcome === "defeat" && (s.phase !== "defeat" || s.journey.outcome !== "defeat")),
      );
    if (summary.lastBattle)
      invalid(
        summary.lastBattle.currency > summary.currency ||
          KEYWORDS.some((keyword) => (summary.lastBattle!.xp[keyword] ?? 0) > (summary.xp[keyword] ?? 0)),
      );
  }
  if (s.expedition) {
    const route = s.expedition;
    if (s.phase === "draft")
      invalid(route.pack !== null || route.recruit !== null || route.lastRoom !== null || s.encounter !== 0);
    else
      invalid(
        route.pack === null ||
          route.pack.length !== (bossEncounter(s) ? 1 : Math.min(3, s.encounter + 1)) ||
          route.pack.some((kind) => species(kind).legendary && !bossEncounter(s)),
      );
    if (route.recruit !== null)
      invalid(s.roster.length >= 5 || !["teamSelection", "support", "campfire"].includes(s.phase));
  } else invalid(s.encounter > 2);
  invalid(
    !unique(s.unlocked) ||
      SPECIES.some((entry) => !s.unlocked.includes(entry.id)) ||
      s.selected.some((kind) => !starterPool.includes(kind)) ||
      (s.phase === "draft" && s.selected.length > starterCount(s)) ||
      (s.phase !== "draft" && !collected.length),
  );
  invalid(
    !unique([...s.team, ...s.reserves].map((c) => c.id)) ||
      !unique(s.lineup) ||
      s.lineup.some((id) => ![...s.team, ...s.reserves].some((c) => c.id === id)) ||
      !unique(s.cards.map((c) => c.id)) ||
      !unique(s.talents) ||
      !unique(s.boons),
  );
  invalid(
    [...s.team, ...s.reserves].some(
      (c) => !s.roster.includes(c.species) || c.health > species(c.species).health,
    ) ||
      s.roster.length !== s.team.length + s.reserves.length ||
      s.roster.some(
        (kind) =>
          s.roster.filter((k) => k === kind).length !==
          [...s.team, ...s.reserves].filter((c) => c.species === kind).length,
      ),
  );
  invalid(
    s.cards.some(
      (c) =>
        !s.team.some(
          (t) =>
            t.id === c.ownerId &&
            (CARDS.some((d) => d.id === c.definitionId && d.species === t.species) ||
              (c.temporary && c.definitionId === PEARL.id && t.species === "memento")),
        ),
    ),
  );
  const permanentCards = s.cards.filter((card) => !card.temporary);
  invalid(
    s.cards.some(
      (card) =>
        card.temporary &&
        (s.phase !== "battle" ||
          !/^copy-(0|[1-9]\d*)$/.test(card.id) ||
          Number(card.id.slice(5)) >= s.battle.copySerial),
    ),
  );
  invalid(permanentCards.some((card) => card.id.startsWith("copy-")));

  for (const creature of s.team)
    for (const def of CARDS.filter((d) => d.species === creature.species))
      invalid(
        permanentCards.filter((c) => c.ownerId === creature.id && c.definitionId === def.id).length !==
          (species(creature.species).legendary ? 2 : 1),
      );
  for (const keyword of KEYWORDS) {
    const bought = TALENTS.filter((t) => t.keyword === keyword && s.talents.includes(t.id));
    invalid(bought.length > talentPoints(s.keywordXP[keyword] ?? 0));
    for (const talent of bought)
      invalid(TALENTS.some((t) => t.keyword === keyword && t.row < talent.row && !s.talents.includes(t.id)));
  }
  if (s.phase === "draft")
    invalid(
      s.team.length !== 0 ||
        s.cards.length !== 0 ||
        s.roster.length !== 0 ||
        s.reserves.length !== 0 ||
        s.lineup.length !== 0,
    );
  else
    invalid(
      s.team.length < 1 ||
        permanentCards.length !==
          s.team.reduce((sum, unit) => sum + ownedCards(unit.id, unit.species).length, 0),
    );
  for (const row of [
    s.team,
    s.lineup.map((id) => [...s.team, ...s.reserves].find((unit) => unit.id === id)!),
  ])
    invalid(
      (row.length === 0 && s.phase !== "draft") ||
        (row.some((unit) => species(unit.species).legendary) && row.length !== 1),
    );
  invalid(s.selected.some((kind) => species(kind).legendary) && s.selected.length !== 1);
  if (s.phase === "teamSelection" || s.phase === "support" || s.phase === "campfire")
    invalid(s.team.some((c, index) => c.id !== s.lineup[index]));
  if (s.support) {
    const v = s.support;
    // Stock keeps its original price when this visit sells Merchant's Favor.
    const prices = merchantPriceRange({ boons: s.boons.filter((boon) => boon !== v.purchased) });
    invalid(
      !s.expedition ||
        v.encounter !== s.encounter ||
        v.id !== `support-${v.encounter}` ||
        !["teamSelection", "support", "campfire"].includes(s.phase) ||
        !v.stock.length ||
        !unique(v.stock.map((r) => r.slot)) ||
        !unique(v.stock.map((r) => r.boon)) ||
        v.stock.some(
          (r, i) =>
            r.slot !== `slot-${i}` ||
            r.price < prices.min ||
            r.price > prices.max ||
            (s.boons.includes(r.boon) && v.purchased !== r.boon),
        ) ||
        (v.purchased !== null &&
          (!v.resolved || !s.boons.includes(v.purchased) || !v.stock.some((r) => r.boon === v.purchased))),
    );
  }
  if (s.phase === "campfire") invalid(s.expedition.lastRoom === "campfire" || !needsCampfire(s));
  if (s.phase !== "battle") invalid(Object.values(s.battleXP).some((n) => n !== 0));
  if (s.reward) {
    const receipt = s.journey!.lastBattle;
    invalid(
      !receipt ||
        receipt.encounter !== s.encounter ||
        receipt.outcome !== s.reward.outcome ||
        receipt.currency !== s.reward.currency ||
        KEYWORDS.some((keyword) => (receipt.xp[keyword] ?? 0) !== (s.reward!.xp[keyword] ?? 0)),
    );
    invalid((!bossEncounter(s) || finalEncounter(s)) && s.reward.boons.length > 0);
    invalid(
      !unique(s.reward.boons) ||
        (s.reward.recruits.length > 0 &&
          JSON.stringify(s.reward.recruits) !==
            JSON.stringify(encounterSource(s).enemies.map((e) => e.species))),
    );
    invalid(
      (s.reward.outcome === "next" && finalEncounter(s)) ||
        (s.reward.outcome === "victory" && !finalEncounter(s)),
    );
    if (s.phase === "recruit") {
      invalid(s.reward.recruits.length !== encounterSource(s).enemies.length);
      const selected = s.reward.selectedRecruit;
      if (selected !== undefined)
        invalid(
          s.roster.length !== 5 ||
            !s.reward.recruits.includes(selected) ||
            s.discovery.recruited[selected] === undefined,
        );
    }
    if (s.phase === "boon") invalid(s.reward.boons.some((r) => s.boons.includes(r)));
    if (s.reward.outcome === "defeat") invalid([...s.team, ...s.reserves].some((c) => c.health > 0));
  }
  if (s.battle) {
    const b = s.battle,
      source = encounterSource(s);
    invalid(b.enemies.length !== source.enemies.length || !unique(b.enemies.map((e) => e.id)));
    b.enemies.forEach((enemy) => {
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
            !CARDS.some((card) => card.id === enemy.lastAbility && card.species === enemy.species)) ||
          enemy.combat.deathDoorUsed ||
          enemy.combat.grace > 0 ||
          (!battlefield(s, "player").some((c) => c.id === enemy.targetId) &&
            !s.team.some((c) => c.id === enemy.targetId)),
      );
    });
    const zones = [...b.draw, ...b.hand, ...b.buffer, ...b.discard];
    // The current turn capacity survives a category reset.
    invalid(
      b.mana > b.maxMana ||
        b.earnedGold > s.currency ||
        (s.journey !== null && b.earnedGold > s.journey.currency),
    );
    invalid(!unique(zones) || zones.some((id) => !s.cards.some((c) => c.id === id)));
    if (s.phase === "battle") {
      invalid([...s.team, ...s.reserves].some((creature) => !creature.combat));
      const liveCards = s.cards;
      invalid(
        ![...s.team, ...s.reserves].some((c) => c.health > 0) ||
          !b.enemies.some((e) => e.health > 0) ||
          (b.buffer.length > 0 && b.hand.length < MAX_HAND_SIZE) ||
          zones.length !== liveCards.length ||
          liveCards.some((c) => !zones.includes(c.id)),
      );
    }
  }
  invalid(s.phase === "victory" && (!finalEncounter(s) || s.wins === 0));
  const allCombatants = [
    ...s.team,
    ...s.reserves,
    ...(s.battle?.enemies ?? []),
    ...(s.battle?.minions ?? []),
  ];
  if (s.battle) {
    for (const enemy of s.battle.enemies) {
      invalid(!!species(enemy.species).legendary !== !!enemy.deck);
      if (enemy.deck) {
        const deck = enemy.deck;
        const zones = [...deck.draw, ...deck.hand, ...deck.buffer, ...deck.discard];
        const defs = CARDS.filter((card) => card.species === enemy.species);
        invalid(
          zones.length !== 6 + deck.pearls ||
            zones.filter((id) => id === PEARL.id).length !== deck.pearls ||
            (deck.buffer.length > 0 && deck.hand.length < MAX_HAND_SIZE),
        );
        for (const def of defs) invalid(zones.filter((id) => id === def.id).length !== 2);
        invalid(zones.some((id) => id !== PEARL.id && !defs.some((def) => def.id === id)));
      }
    }
    for (const unit of s.battle.minions ?? []) {
      const owners = unit.minion.side === "player" ? [...s.team, ...s.reserves] : s.battle.enemies;
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
        (s.battle.minions ?? []).filter((other) => other.minion.ownerId === unit.minion.ownerId).length > 2,
      );
      invalid(
        unit.health > 0 &&
          (!owner ||
            owner.health === 0 ||
            (unit.minion.side === "player" && !s.team.some((entry) => entry.id === owner.id))),
      );
    }
  }
  invalid(!unique(allCombatants.map((unit) => unit.id)));
  for (const unit of allCombatants)
    if (unit.combat) {
      const stats = unit.combat;
      invalid((stats.controlled === null) !== (stats.controlTurns === 0));
      invalid((stats.grace > 0 && !stats.deathDoorUsed) || (stats.controlled !== null && stats.cooldown > 0));
      invalid(
        Object.values(stats.statusSources).some((id) => !allCombatants.some((unit) => unit.id === id)) ||
          stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0) > stats.bleed ||
          stats.bleedLeech.some((row) => !allCombatants.some((source) => source.id === row.sourceId)),
      );
    }
  return freeze(s, true);
}
export function encodeSave(state: GameState) {
  return JSON.stringify(state);
}
