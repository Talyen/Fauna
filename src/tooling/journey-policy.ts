import { canBuyTalent, starterCount, MAX_CREATURE_STARS } from "../game/progression";
import { canVisitCampfire, canVisitMerchant, canRecruitDestination } from "../game/destinations";
import { rankedBattleChoices } from "../application/battle-policy";
import { TALENTS, BOONS, species, speciesCards, type BoonId } from "../game/content";
import { capabilities, coverageScore, offenseValue } from "../application/team-policy";
import { recruitLineup } from "../game/team";
import { createBattleActor } from "../application/battle-actor";
import type { Command, GameState } from "../game/types";
import type { JourneyConfig } from "./playthrough";

export interface JourneyDecision {
  command: Command;
  reason: string;
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
  const cards = kinds.flatMap(speciesCards);
  const effect = (kind: (typeof cards)[number]["effect"]) => cards.some((card) => card.effect === kind);
  const swapping = effect("swap") || effect("swapChosen") || effect("swapDodge") || effect("swapLowest");
  const thorns =
    effect("dreamDouble") ||
    effect("waterThorns") ||
    effect("sparkDecoy") ||
    effect("teamProtection") ||
    state.boons.includes("ironwood-buckler") ||
    cards.some((card) => card.effects?.some((extra) => extra.kind === "status" && extra.status === "thorns"));
  switch (boon) {
    case "grafting-needle":
      return healing && has.has("armor") ? 60 : 0;
    case "lovers-knot":
    case "last-threshold":
      return healing ? 60 : 0;
    case "camp-hammock":
      return healing && state.reserves.some((unit) => unit.health > 0) ? 60 : 0;
    case "thaw-spoon":
      return healing ? 40 : 0;
    case "coral-net-weight":
    case "crater-punch":
    case "dream-yo-yo":
    case "wonder-domino":
      return has.has("attack") ? 50 : 0;
    case "moonveil-mask":
    case "apiary-smoker":
      return effect("teamBlind") ||
        cards.some((card) => card.effects?.some((extra) => extra.kind === "blind"))
        ? 50
        : 0;
    case "mercury-metronome":
      return kinds.length > 1 ? 60 : 0;
    case "raincatcher-bowl":
      return has.has("water") ? 80 : 0;
    case "thunder-conch":
    case "tuning-fork-charm":
      return has.has("stun") ? 60 : 0;
    case "thistle-sieve":
    case "calendula-soap":
    case "orbit-armillary":
      return has.has("cleanse") || state.boons.includes("knot-comb") ? 50 : 0;
    case "cloud-cup-and-ball":
    case "fallingstar-anvil":
    case "pleated-pagoda":
    case "moss-oven-mitt":
    case "rain-cape":
      return has.has("block") ? 60 : 0;
    case "echo-lens":
      return effect("dreamDouble") || effect("sparkDecoy") ? 50 : 0;
    case "brookskip-disc":
      return has.has("water") ? 60 : 0;
    case "nectar-dipper":
      return effect("createFood") || kinds.some((kind) => kind === "aerostat") ? 60 : 0;
    case "saddle-pouch":
      return swapping && state.reserves.some((unit) => unit.health > 0) ? 60 : 0;
    case "dune-shuttle":
    case "encore-baton":
    case "mineral-bookend":
      return 60;
    case "story-puzzle-cube":
      return ["burn", "poison", "bleed", "stun", "freeze"].filter((keyword) => has.has(keyword)).length +
        Number(
          effect("teamBlind") || cards.some((card) => card.effects?.some((extra) => extra.kind === "blind")),
        ) >=
        3
        ? 60
        : 0;
    case "briar-racquet":
      return thorns ? 50 : 0;
    case "cinder-fan":
      return has.has("burn") ? 60 : 0;
    case "pruning-crescent":
      return has.has("purge") || cards.some((card) => card.effect === "attack" && card.purgeThorns) ? 50 : 0;
    case "knot-comb":
    case "basalt-glass-bookmark":
      return 40;
    case "honeycomb-frame":
      return has.has("armor") ? 50 : 0;
    case "rainkeeper":
      return has.has("mana") || state.boons.includes("resonant-chimes") ? 60 : 0;
    case "furnace-prism":
      return has.has("light") && has.has("burn") ? 60 : 0;
    case "undertow-castanets":
      return has.has("stun") && has.has("freeze") ? 60 : 0;
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
function recruitDecision(state: GameState): JourneyDecision {
  const selected = state.phase === "recruit" ? state.reward.selectedRecruit : undefined;
  const offers = selected === undefined ? state.reward!.recruits : [selected];
  const roster = [...state.team, ...state.reserves];
  const living = (units: typeof roster) => units.filter((unit) => unit.health > 0);
  const before = capabilities(
    state,
    living(roster).map((unit) => unit.species),
  );
  const score = (next: typeof roster, active: typeof roster) =>
    coverageScore(
      state,
      living(next).map((unit) => unit.species),
    ) +
    coverageScore(
      state,
      living(active).map((unit) => unit.species),
    ) *
      2 +
    living(active).reduce((sum, unit) => sum + offenseValue(state, unit.species) * 300 + 200, 0) +
    next.reduce((sum, unit) => sum + unit.health / species(unit.species).health, 0) * 20 +
    state.boons.reduce(
      (sum, boon) =>
        sum +
        boonValue(
          state,
          boon,
          living(next).map((unit) => unit.species),
        ),
      0,
    );
  const keep = score(roster, state.team);
  const options = offers.flatMap((kind) =>
    (roster.length === 5 ? roster : [undefined]).map((released) => {
      const incoming = {
        id: "candidate",
        species: kind,
        health: species(kind).health,
        block: 0,
        attacked: false,
      };
      const next = [...roster.filter((unit) => unit !== released), incoming];
      const active = recruitLineup(state, incoming, released?.id).map((id) =>
        next.find((unit) => unit.id === id)!,
      );
      const after = capabilities(
        state,
        living(next).map((unit) => unit.species),
      );
      const lost = ["armorBypass", "purge"].filter((role) => before.has(role) && !after.has(role));
      // A repeated recruit can improve an owned passive even when deployment is unchanged.
      const rankGain =
        selected === undefined &&
        (state.discovery.recruited[kind] ?? 0) > 0 &&
        (state.discovery.recruited[kind] ?? 0) < MAX_CREATURE_STARS + 1
          ? 100
          : 0;
      return {
        kind,
        released,
        lost,
        score: score(next, active) + rankGain,
        key: `${kind}:${released?.id ?? ""}`,
      };
    }),
  );
  options.sort((a, b) => a.lost.length - b.lost.length || b.score - a.score || a.key.localeCompare(b.key));
  const chosen = options[0];
  if (selected === undefined)
    return {
      command: { type: "recruit", species: chosen?.kind ?? offers[0]! },
      reason: "Commit the offered recruit to Collection before choosing the team",
    };
  if (!chosen || chosen.lost.length || chosen.score <= keep)
    return {
      command: { type: "confirmRecruit" },
      reason: "Keep the current roster and its deployed damage, recovery and unique coverage",
    };
  return {
    command: { type: "confirmRecruit", replace: chosen.released!.id },
    reason: `Add ${species(selected).name}; release ${species(chosen.released!.species).name}; preserve living damage, Armor bypass and Purge`,
  };
}

export function createJourneyActor(config: Pick<JourneyConfig, "seed" | "starter" | "policy">) {
  const battle = createBattleActor();
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
            { type: "recruitDestination", species: state.expedition.recruit! },
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
          : state.reward.selectedRecruit !== undefined
            ? decision(
                { type: "confirmRecruit", replace: pick([...state.team, ...state.reserves]).id },
                "Choose a replacement using policy RNG",
              )
            : decision(
                { type: "recruit", species: pick(state.reward.recruits) },
                "Choose a recruit using policy RNG",
              );
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
        if (config.policy !== "random") return battle.choose(state);
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
