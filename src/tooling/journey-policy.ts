import { canBuyTalent, creaturePassive, starterCount } from "../game/progression";
import { canVisitCampfire, canVisitMerchant, canRecruitDestination } from "../game/destinations";
import { rankedBattleChoices } from "../application/battle-policy";
import { CARDS, TALENTS, BOONS, species, type SpeciesId, type BoonId } from "../game/content";
import { definitionKeywords } from "../game/keywords";
import type { Command, GameState } from "../game/types";
import type { JourneyConfig } from "./playthrough";

export interface JourneyDecision {
  command: Command;
  reason: string;
}
function capabilities(state: GameState, kinds: readonly SpeciesId[]) {
  const result = new Set<string>();
  for (const kind of kinds) {
    for (const card of CARDS.filter((card) => card.species === kind)) {
      for (const keyword of definitionKeywords(card)) result.add(keyword);
      if (card.effect === "attack") {
        result.add("attack");
        if (
          [card.damageType, card.alternateDamageType].some(
            (type) => type && type !== "physical" && type !== "stun",
          )
        )
          result.add("armorBypass");
      }
      if (
        card.effect === "waterThorns" ||
        card.effect === "teamProtection" ||
        card.effects?.some(
          (effect) =>
            effect.kind === "damage" && effect.damageType !== "physical" && effect.damageType !== "stun",
        )
      )
        result.add("armorBypass");
      if (card.effect === "teamPurge" || card.effects?.some((effect) => effect.kind === "purge"))
        result.add("purge");
      if (card.effect === "teamCleanse" || card.effects?.some((effect) => effect.kind === "cleanse"))
        result.add("cleanse");
    }
    for (const effect of creaturePassive(state, kind).effects) {
      if (effect.kind === "courtRemembers") {
        result.add("attack");
        result.add("water");
        result.add("armorBypass");
      }
      if (effect.kind === "livingChorus" || effect.kind === "tidalRegeneration") result.add("health");
      if (effect.kind === "dodgeBurn") {
        result.add("burn");
        result.add("armorBypass");
      }
      if (effect.kind === "poisonRetaliation") {
        result.add("poison");
        result.add("armorBypass");
      }
    }
  }
  return result;
}
/** Rough usefulness, never a power or win-rate estimate; absent triggers score zero. */
export function boonValue(
  state: GameState,
  boon: BoonId,
  kinds = [...state.team, ...state.reserves].filter((unit) => unit.health > 0).map((unit) => unit.species),
): number {
  const has = capabilities(state, kinds);
  const healing =
    has.has("health") ||
    has.has("leech") ||
    state.boons.includes("bone-charm") ||
    state.boons.includes("sin-eaters-lantern");
  switch (boon) {
    case "resonant-chimes":
      return 90;
    case "tattered-pages":
      return 80;
    case "bone-charm":
      return 70;
    case "ironwood-buckler":
      return has.has("block") ? 70 : 0;
    case "icy-heart":
      return has.has("freeze") ? 70 : 0;
    case "meteorite":
      return has.has("burn") ? 80 : 0;
    case "sin-eaters-lantern":
      return has.has("cleanse") ||
        state.talents.some((id) => ["health.last-resort", "health.clean-slate"].includes(id))
        ? 70
        : 0;
    case "thunderstone":
      return has.has("stun") ? 70 : 0;
    case "groves-favor":
      return healing ? 60 : 0;
    case "brass-censer":
      return has.has("light") ? 60 : 0;
    case "parasitic-bloom":
      return has.has("poison") ? 60 : 0;
    case "cutpurse-knife":
      return has.has("bleed") ? 40 : 0;
    case "merchants-favor":
      return state.encounter < 6 ? 25 : 0;
    case "plague-doctors-mask":
      return 30;
    case "sundering-charm":
      return has.has("physical") || has.has("stun") ? 75 : 0;
    case "smugglers-map":
      return 20;
    case "frozen-pocketwatch":
      return has.has("freeze") ? 60 : 0;
    case "lucky-clover":
      return has.has("nature") ? 40 : 0;
    default: {
      const unhandled: never = boon;
      throw new Error(`Unhandled Boon: ${unhandled}`);
    }
  }
}
function coverageScore(state: GameState, kinds: SpeciesId[]) {
  const has = capabilities(state, kinds);
  return (
    (has.has("attack") ? 3000 : 0) +
    (has.has("armorBypass") ? 1000 : 0) +
    (has.has("purge") ? 800 : 0) +
    (has.has("health") ? 200 : 0) +
    (has.has("cleanse") ? 100 : 0) +
    has.size * 20
  );
}
function recruitDecision(state: GameState): JourneyDecision {
  const roster = [...state.team, ...state.reserves];
  const before = capabilities(
    state,
    roster.map((unit) => unit.species),
  );
  const options = state.reward!.recruits.flatMap((kind) =>
    (roster.length === 5 ? roster : [undefined]).map((released) => {
      const next = [
        ...roster.filter((unit) => unit !== released),
        { id: "candidate", species: kind, health: species(kind).health },
      ];
      const kinds = next.map((unit) => unit.species);
      const after = capabilities(state, kinds);
      const lost = ["armorBypass", "purge"].filter((role) => before.has(role) && !after.has(role));
      let active = state.team.map((unit) => (unit === released ? kind : unit.species));
      if (
        !released &&
        active.length < 3 &&
        !species(kind).legendary &&
        !active.some((kind) => species(kind).legendary)
      )
        active.push(kind);
      if (active.some((kind) => species(kind).legendary))
        active = active.filter((kind) => species(kind).legendary);
      const score =
        coverageScore(
          state,
          next.filter((unit) => unit.health > 0).map((unit) => unit.species),
        ) +
        coverageScore(state, active) +
        next.reduce((sum, unit) => sum + unit.health / species(unit.species).health, 0) * 20 +
        state.boons.reduce((sum, boon) => sum + boonValue(state, boon, kinds), 0);
      return { kind, released, lost, score, key: `${kind}:${released?.id ?? ""}` };
    }),
  );
  options.sort((a, b) => a.lost.length - b.lost.length || b.score - a.score || a.key.localeCompare(b.key));
  const chosen = options[0];
  if (!chosen) return { command: { type: "skipRecruit" }, reason: "No recruit was offered" };
  return {
    command: {
      type: "recruit",
      species: chosen.kind,
      ...(chosen.released ? { replace: chosen.released.id } : {}),
    },
    reason: `Recruit ${species(chosen.kind).name}${chosen.released ? `; release ${species(chosen.released.species).name}` : ""}; retain Armor bypass and Purge where possible, then favor living damage coverage, recovery and owned Boons`,
  };
}

export function createJourneyActor(config: Pick<JourneyConfig, "seed" | "starter" | "policy">) {
  let rng = (config.seed ^ 0x9e3779b9) >>> 0;
  const pick = <T>(items: readonly T[]) => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return items[Math.floor((rng / 4294967296) * items.length)]!;
  };
  return (state: GameState): JourneyDecision => {
    const decision = (command: Command, reason: string) => ({ command, reason });
    const talent = TALENTS.find((entry) => canBuyTalent(state, entry.id));
    if (talent)
      return decision(
        { type: "buyTalent", talentId: talent.id },
        "Buy the next available talent with earned points",
      );
    switch (state.phase) {
      case "draft":
        return state.selected.length === starterCount(state)
          ? decision({ type: "start" }, "Start the selected lineup")
          : decision(
              {
                type: "draft",
                species: state.starterOffers.includes(config.starter)
                  ? config.starter
                  : pick(state.starterOffers),
              },
              "Choose the requested starter when offered; otherwise use policy RNG",
            );
      case "campfire":
        return decision({ type: "rest" }, "Recover missing roster Health and knockouts");
      case "support": {
        const visit = state.support!;
        if (visit.resolved)
          return decision({ type: "leaveSupport", visit: visit.id }, "Leave after the committed purchase");
        const affordable = visit.stock.filter((slot) => slot.price <= state.currency);
        const slot =
          config.policy === "random"
            ? affordable[0]
            : affordable
                .filter((slot) => boonValue(state, slot.boon) > 0)
                .sort(
                  (a, b) =>
                    boonValue(state, b.boon) / b.price - boonValue(state, a.boon) / a.price ||
                    a.price - b.price ||
                    a.slot.localeCompare(b.slot),
                )[0];
        return slot
          ? decision(
              { type: "buyBoon", visit: visit.id, slot: slot.slot },
              config.policy === "random"
                ? "Control policy buys the first affordable saved stock slot"
                : `Buy ${BOONS.find((boon) => boon.id === slot.boon)!.name}; useful roster triggers at ${slot.price} Gold`,
            )
          : decision(
              { type: "leaveSupport", visit: visit.id },
              "Save Gold; no affordable Boon has a supported roster trigger",
            );
      }
      case "teamSelection":
        if (canVisitCampfire(state))
          return decision(
            { type: "visitCampfire" },
            "Restore the roster before choosing recruits or purchases",
          );
        if (canRecruitDestination(state))
          return decision(
            { type: "recruitDestination", species: state.expedition!.recruit! },
            "Fill a free roster slot with the saved recruit",
          );
        if (canVisitMerchant(state))
          return decision(
            { type: "enterSupport", visit: state.support!.id },
            "Inspect the saved Merchant stock",
          );
        return decision({ type: "beginBattle" }, "Begin the next saved encounter");
      case "recruit":
        return config.policy === "heuristic"
          ? recruitDecision(state)
          : state.reward!.recruits.length
            ? decision(
                {
                  type: "recruit",
                  species: pick(state.reward!.recruits),
                  ...(state.roster.length === 5
                    ? { replace: pick([...state.team, ...state.reserves]).id }
                    : {}),
                },
                "Choose recruit and release using policy RNG",
              )
            : decision({ type: "skipRecruit" }, "No recruit was offered");
      case "boon": {
        const offers = state.reward!.boons;
        const boon =
          config.policy === "random"
            ? offers.length
              ? pick(offers)
              : undefined
            : [...offers]
                .filter((boon) => boonValue(state, boon) > 0)
                .sort((a, b) => boonValue(state, b) - boonValue(state, a) || a.localeCompare(b))[0];
        return boon
          ? decision(
              { type: "chooseBoon", boon },
              config.policy === "random"
                ? "Choose an offered Boon using policy RNG"
                : `Choose ${BOONS.find((entry) => entry.id === boon)!.name} for supported roster triggers`,
            )
          : decision({ type: "skipBoon" }, "No offered Boon has a supported roster trigger");
      }
      case "victory":
      case "defeat":
        return decision(
          { type: "newRun", seed: (config.seed + state.revision) >>> 0 },
          "Begin the next requested journey",
        );
      case "battle": {
        const choices = rankedBattleChoices(state);
        return choices.length
          ? config.policy === "random"
            ? pick(choices)
            : choices[0]!
          : decision({ type: "endTurn" }, "No affordable playable card has a scored visible benefit");
      }
    }
  };
}
