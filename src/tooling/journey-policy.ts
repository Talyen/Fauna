import { canBuyTalent, starterCount, MAX_CREATURE_STARS } from "../game/progression";
import { canVisitCampfire, canVisitMerchant, canRecruitDestination } from "../game/destinations";
import { rankedBattleChoices } from "../application/battle-policy";
import { TALENTS, BOONS, species, speciesCards, type BoonId } from "../game/content";
import { capabilities, coverageScore, offenseValue, scoreCapabilities } from "../application/team-policy";
import { recruitLineup } from "../game/team";
import { createBattleActor } from "../application/battle-actor";
import type { Command, GameState } from "../game/types";
import type { JourneyConfig } from "./playthrough";

export interface JourneyDecision {
  command: Command;
  reason: string;
}
function livingKinds(units: readonly GameState["team"][number][]) {
  const kinds: GameState["team"][number]["species"][] = [];
  for (const unit of units) if (unit.health > 0) kinds.push(unit.species);
  return kinds;
}
type KitTraits = {
  effects: Set<ReturnType<typeof speciesCards>[number]["effect"]>;
  blind: boolean;
  thorns: boolean;
  reflection: boolean;
  healing: boolean;
  purgeThorns: boolean;
};
const kitTraits = new Map<GameState["team"][number]["species"], KitTraits>();
function traitsFor(kind: GameState["team"][number]["species"]): KitTraits {
  const cached = kitTraits.get(kind);
  if (cached) return cached;
  const traits: KitTraits = {
    effects: new Set(),
    blind: false,
    thorns: false,
    reflection: false,
    healing: false,
    purgeThorns: false,
  };
  for (const card of speciesCards(kind)) {
    traits.effects.add(card.effect);
    if (card.effect === "attack" && card.purgeThorns) traits.purgeThorns = true;
    for (const extra of card.effects ?? []) {
      if (extra.kind === "blind") traits.blind = true;
      if (extra.kind === "status" && extra.status === "thorns") traits.thorns = true;
      if (extra.kind === "reflect") traits.reflection = true;
      if (extra.kind === "heal") traits.healing = true;
    }
  }
  kitTraits.set(kind, traits);
  return traits;
}

/** Prepare roster facts once when comparing multiple Boons. */
function boonScorer(
  state: GameState,
  kinds = livingKinds([...state.team, ...state.reserves]),
  has = capabilities(state, kinds),
) {
  let healing: boolean | undefined;
  const canHeal = () =>
    (healing ??=
      has.has("health") ||
      has.has("leech") ||
      state.boons.includes("bone-charm") ||
      state.boons.includes("sin-eaters-lantern"));
  let traits: KitTraits[] | undefined;
  const kits = () => (traits ??= kinds.map(traitsFor));
  const effect = (kind: ReturnType<typeof speciesCards>[number]["effect"]) =>
    kits().some((kit) => kit.effects.has(kind));
  let blind: boolean | undefined;
  const hasBlind = () => (blind ??= effect("teamBlind") || kits().some((kit) => kit.blind));
  let food: boolean | undefined;
  const createsFood = () =>
    (food ??= effect("createFood") || kinds.includes("aerostat") || state.boons.includes("cornucopia"));
  let livingBackup: boolean | undefined;
  const hasLivingBackup = () => (livingBackup ??= state.reserves.some((unit) => unit.health > 0));
  let swapping: boolean | undefined;
  const canSwap = () =>
    (swapping ??= effect("swap") || effect("swapChosen") || effect("swapDodge") || effect("swapLowest"));
  let thorns: boolean | undefined;
  const hasThorns = () =>
    (thorns ??=
      effect("dreamDouble") ||
      effect("teamProtection") ||
      state.boons.includes("ironwood-buckler") ||
      kits().some((kit) => kit.thorns));
  let reflection: boolean | undefined;
  const hasReflection = () => (reflection ??= kits().some((kit) => kit.reflection));
  return (boon: BoonId): number => {
    switch (boon) {
      case "sandfold-parasol":
        return kinds.length > 1 ? (has.has("dodge") ? 60 : 30) : 0;
      case "ribbon-spool":
        return kinds.length > 1 ? 50 : 0;
      case "dawn-key":
      case "suncrust-rolling-pin":
      case "brass-censer":
        return has.has("light") ? 60 : 0;
      case "crystal-slipper":
      case "skyiron-horseshoe":
      case "acrobat-top":
      case "vanishing-hat":
      case "quiet-pinwheel":
      case "leafwing-shuttlecock":
      case "echo-ocarina":
        return has.has("dodge") ? 60 : 30;
      case "moonseed":
        return has.has("light") && hasThorns() ? 60 : 0;
      case "bargain-scales":
        return state.encounter < 6 ? 40 : 0;
      case "dragons-toothpick":
        return createsFood() && has.has("attack") ? 60 : 0;
      case "sleepy-acorn":
        return effect("heal") || kits().some((kit) => kit.healing) ? 50 : 0;
      case "cuckoo-whistle":
      case "nightbloom-bell":
      case "dew-pendulum":
      case "rootvault-pole":
      case "hearth-coal":
      case "vigil-lantern":
      case "gemmed-scabbard":
      case "knot-comb":
      case "basalt-glass-bookmark":
        return 40;
      case "orchard-ladder-charm":
        return createsFood() && hasLivingBackup() ? 60 : 0;
      case "spore-trivet":
        return createsFood() ? 50 : 0;
      case "victory-laurel":
      case "cornucopia":
      case "bone-charm":
        return 70;
      case "gilt-gauntlet":
      case "stardust-whetstone":
        return has.has("physical") ? 60 : 0;
      case "pumice-glass-inkwell":
      case "blooming-still":
      case "miracle-megaphone":
      case "thistle-sieve":
      case "calendula-soap":
      case "orbit-armillary":
        return has.has("cleanse") || state.boons.includes("knot-comb") ? 50 : 0;
      case "chime-crucible":
      case "crystal-harp":
      case "asteroid-hammer":
      case "acorn-skittle":
      case "thunder-conch":
      case "tuning-fork-charm":
        return has.has("stun") ? 60 : 0;
      case "orbit-tongs":
        return kinds.length > 1 &&
          ((has.has("physical") && state.boons.includes("gilt-gauntlet")) ||
            (has.has("dodge") && state.boons.includes("skyiron-horseshoe")) ||
            (has.has("leech") && state.talents.includes("leech.armor-siphon")))
          ? 60
          : 0;
      case "memory-cairn":
      case "remembrance-wreath":
        return effect("resurrect") ? 60 : 0;
      case "vow-candle":
        return has.has("light") ? 50 : 0;
      case "ember-platter":
      case "ash-bowl":
      case "chestnut-roaster":
      case "ashfall-pendant":
      case "lava-cameo":
      case "last-candle":
      case "molten-paperweight":
      case "cinder-fan":
        return has.has("burn") ? 60 : 0;
      case "mossball":
      case "pollen-basket":
        return kinds.length > 1 && hasThorns() ? 60 : 0;
      case "treaty-teapot":
      case "briar-racquet":
        return hasThorns() ? 50 : 0;
      case "nebula-weld-clamp":
      case "honeycomb-frame":
        return has.has("armor") ? 50 : 0;
      case "clover-measuring-scoop":
      case "yarrow-salve-tin":
      case "lovers-knot":
      case "last-threshold":
      case "groves-favor":
        return canHeal() ? 60 : 0;
      case "dawn-gong":
        return kinds.length > 1 ? 40 : 0;
      case "rocking-chair-charm":
        return hasLivingBackup() ? 50 : 0;
      case "snowbell":
      case "solstice-concertina":
      case "moonpath-divider":
      case "frostglass-die":
      case "frozen-pocketwatch":
        return has.has("freeze") ? 60 : 0;
      case "harvest-sickle":
      case "harvest-shears":
        return has.has("bleed") ? 60 : 0;
      case "meadow-mortar":
        return has.has("poison") && has.has("purge") ? 60 : 0;
      case "rosewax-seal":
      case "rootspool":
      case "tidecrest-hairpin":
      case "comb-uncapping-fork":
      case "resonance-kalimba":
      case "thornheart-ring":
        return hasThorns() ? 60 : 0;
      case "crown-waffle-iron":
        return createsFood() && has.has("block") ? 60 : 0;
      case "beeswax-crown":
      case "folded-mountain":
      case "cypress-reliquary":
        return has.has("armor") ? 60 : 0;
      case "overflow-cup":
        return canHeal() && kinds.length > 1 ? 60 : 0;
      case "ripple-mirror":
        return hasReflection() ? 60 : 0;
      case "sail-needle":
      case "dandelion-poultice":
        return has.has("cleanse") || state.boons.includes("knot-comb") ? 60 : 0;
      case "winterseed":
        return has.has("block") ? 40 : 0;
      case "lagoon-chalice":
        return has.has("water") && has.has("block") ? 60 : 0;
      case "wonder-kaleidoscope":
      case "star-hoop":
        return hasReflection() ? 50 : 0;
      case "welcome-doormat":
        return canSwap() ? 50 : 0;
      case "shelter-lantern":
        return has.has("block") ? 50 : 0;
      case "chamomile-compress":
        return canHeal() ? 50 : 0;
      case "cadence-panpipes":
      case "chromatic-viol":
      case "aether-gramophone":
      case "dream-tangram":
      case "eclipse-protractor":
      case "crescent-sextant":
      case "coral-net-weight":
      case "crater-punch":
      case "dream-yo-yo":
      case "wonder-domino":
        return has.has("attack") ? 50 : 0;
      case "hearthcap-kettle":
      case "sovereign-toast-rack":
      case "pumpkin-tureen":
      case "field-lunch-basket":
      case "blossom-cake-stand":
      case "nectar-dipper":
      case "velvet-whisk":
        return effect("createFood") || kinds.includes("aerostat") ? 60 : 0;
      case "caravan-rug":
        return has.has("block") && hasLivingBackup() ? 60 : 0;
      case "apple-press":
        return has.has("bleed") ||
          (has.has("physical") &&
            (state.boons.includes("stardust-whetstone") ||
              state.talents.includes("physical.lacerate") ||
              (has.has("dodge") && state.talents.includes("bleed.parting-cut")))) ||
          (has.has("nature") && state.talents.includes("nature.briar-patch")) ||
          (has.has("poison") && state.talents.includes("poison.hemotoxin"))
          ? 60
          : 0;
      case "farewell-oar":
        return canSwap() && has.has("block") ? 60 : 0;
      case "oasis-seed":
        return kinds.length > 1 && canHeal() && has.has("attack") ? 60 : 0;
      case "bellows-heart":
        return canHeal() && has.has("burn") ? 60 : 0;
      case "soot-brush":
        return has.has("cleanse") || state.boons.includes("knot-comb") ? 40 : 0;
      case "glassleaf-shield":
      case "cloud-cup-and-ball":
      case "fallingstar-anvil":
      case "pleated-pagoda":
      case "moss-oven-mitt":
      case "rain-cape":
        return has.has("block") ? 60 : 0;
      case "reef-diadem":
        return has.has("water") && hasThorns() ? 60 : 0;
      case "mirror-locket":
      case "obsidian-pitcher":
        return has.has("leech") ? 60 : 0;
      case "herbarium-press":
        return has.has("poison") && has.has("freeze") ? 50 : 0;
      case "honey-press":
      case "pattern-reel":
      case "winnowing-sieve":
      case "pearl-sieve":
      case "prism-chisel":
        return has.has("purge") ? 60 : 0;
      case "rook-of-mercy":
      case "prayer-sailboat":
      case "accordioned-bridge":
      case "tide-anklet":
        return canSwap() ? 60 : 0;
      case "wishing-building-block":
        return has.has("armor") && kinds.length > 1 ? 60 : 0;
      case "hoard-lockplate":
      case "geode-anvil":
      case "origami-staircase":
      case "wax-foundation-mold":
        return has.has("armor") && has.has("block") ? 60 : 0;
      case "fern-fencing-foil":
        return has.has("dodge") ? 60 : 0;
      case "reef-casket":
      case "coronation-cloche":
      case "paper-lotus":
        return effect("nullify") ? 50 : 0;
      case "peace-knot":
        return kinds.length > 1 && (effect("nullify") || state.boons.includes("calendula-soap")) ? 50 : 0;
      case "eclipse-rivet":
        return kinds.length > 1 && has.has("armor") ? 50 : 0;
      case "poppy-seed-grinder":
      case "parasitic-bloom":
        return has.has("poison") ? 60 : 0;
      case "reef-incense-tile":
        return has.has("water") && hasBlind() ? 60 : 0;
      case "coral-music-box":
        return has.has("block") && has.has("water") ? 60 : 0;
      case "grain-flail":
        return has.has("attack") ? 60 : 0;
      case "comet-crucible":
        return has.has("armor") ? 40 : 0;
      case "journey-loom":
        return effect("recover") && kinds.length > 1 ? 60 : 0;
      case "devotion-clasp":
        return kinds.length > 1 && (effect("dreamDouble") || effect("sparkDecoy")) ? 50 : 0;
      case "wonder-ball-maze":
      case "sleepers-urn":
        return has.has("stun") || has.has("freeze") ? 60 : 0;
      case "facet-abacus":
      case "dune-shuttle":
      case "encore-baton":
      case "mineral-bookend":
        return 60;
      case "moonboat-toy":
      case "brookskip-disc":
        return has.has("water") ? 60 : 0;
      case "grafting-needle":
        return canHeal() && has.has("armor") ? 60 : 0;
      case "camp-hammock":
        return canHeal() && hasLivingBackup() ? 60 : 0;
      case "thaw-spoon":
        return canHeal() ? 40 : 0;
      case "moonveil-mask":
      case "apiary-smoker":
        return hasBlind() ? 50 : 0;
      case "mercury-metronome":
        return kinds.length > 1 ? 60 : 0;
      case "raincatcher-bowl":
        return has.has("water") ? 80 : 0;
      case "echo-lens":
        return effect("dreamDouble") || effect("sparkDecoy") ? 50 : 0;
      case "saddle-pouch":
        return canSwap() && hasLivingBackup() ? 60 : 0;
      case "story-puzzle-cube":
        return Number(has.has("burn")) +
          Number(has.has("poison")) +
          Number(has.has("bleed")) +
          Number(has.has("stun")) +
          Number(has.has("freeze")) +
          Number(hasBlind()) >=
          3
          ? 60
          : 0;
      case "pruning-crescent":
        return has.has("purge") || kits().some((kit) => kit.purgeThorns) ? 50 : 0;
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
      case "ironwood-buckler":
        return has.has("block") ? 70 : 0;
      case "icy-heart":
        return has.has("freeze") ? 70 : 0;
      case "meteorite":
        return has.has("burn") ? 80 : 0;
      case "sin-eaters-lantern":
        return has.has("cleanse") ||
          state.talents.some((id) => id === "health.last-resort" || id === "health.clean-slate")
          ? 70
          : 0;
      case "thunderstone":
        return has.has("stun") ? 70 : 0;
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
      case "lucky-clover":
        return has.has("nature") ? 40 : 0;
      default: {
        const unhandled: never = boon;
        throw new Error(`Unhandled Boon: ${unhandled}`);
      }
    }
  };
}
/** Rough usefulness, never a power or win-rate estimate; absent triggers score zero. */
export function boonValue(state: GameState, boon: BoonId, kinds?: GameState["team"][number]["species"][]) {
  return boonScorer(state, kinds)(boon);
}
function recruitDecision(state: GameState): JourneyDecision {
  const selected = state.phase === "recruit" ? state.reward.selectedRecruit : undefined;
  const offers = selected === undefined ? state.reward!.recruits : [selected];
  const roster = [...state.team, ...state.reserves];
  const rosterKinds = livingKinds(roster);
  const before = capabilities(state, rosterKinds);
  const score = (
    next: typeof roster,
    active: typeof roster,
    nextKinds: ReturnType<typeof livingKinds>,
    nextCapabilities: ReturnType<typeof capabilities>,
  ) => {
    const activeKinds: ReturnType<typeof livingKinds> = [];
    let activeOffense = 0;
    for (const unit of active) {
      if (!(unit.health > 0)) continue;
      activeKinds.push(unit.species);
      activeOffense = activeOffense + offenseValue(state, unit.species) * 300 + 200;
    }
    const scoreBoon = state.boons.length ? boonScorer(state, nextKinds, nextCapabilities) : undefined;
    return (
      scoreCapabilities(nextCapabilities) +
      coverageScore(state, activeKinds) * 2 +
      activeOffense +
      next.reduce((sum, unit) => sum + unit.health / species(unit.species).health, 0) * 20 +
      state.boons.reduce((sum, boon) => sum + scoreBoon!(boon), 0)
    );
  };
  const keep = score(roster, state.team, rosterKinds, before);
  const options = offers.flatMap((kind) => {
    const incoming = {
      id: "candidate",
      species: kind,
      health: species(kind).health,
      block: 0,
      attacked: false,
    };
    // A repeated recruit can improve an owned passive even when deployment is unchanged.
    const rankGain =
      selected === undefined &&
      (state.discovery.recruited[kind] ?? 0) > 0 &&
      (state.discovery.recruited[kind] ?? 0) < MAX_CREATURE_STARS + 1
        ? 100
        : 0;
    return (roster.length === 5 ? roster : [undefined]).map((released) => {
      const next = released
        ? [...roster.filter((unit) => unit !== released), incoming]
        : [...roster, incoming];
      const active = recruitLineup(state, incoming, released?.id).map((id) =>
        next.find((unit) => unit.id === id)!,
      );
      const nextKinds = livingKinds(next);
      const after = capabilities(state, nextKinds);
      const lost =
        Number(before.has("armorBypass") && !after.has("armorBypass")) +
        Number(before.has("purge") && !after.has("purge"));
      return {
        kind,
        released,
        lost,
        score: score(next, active, nextKinds, after) + rankGain,
        key: `${kind}:${released?.id ?? ""}`,
      };
    });
  });
  const compare = (a: (typeof options)[number], b: (typeof options)[number]) =>
    a.lost - b.lost || b.score - a.score || a.key.localeCompare(b.key);
  let chosen: (typeof options)[number] | undefined;
  for (const option of options) if (!chosen || compare(option, chosen) < 0) chosen = option;
  if (selected === undefined)
    return {
      command: { type: "recruit", species: chosen?.kind ?? offers[0]! },
      reason: "Commit the offered recruit to Collection before choosing the team",
    };
  if (!chosen || chosen.lost || chosen.score <= keep)
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
  return (state: GameState, stalled = false): JourneyDecision => {
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
        let slot: (typeof visit.stock)[number] | undefined;
        if (config.policy === "random") slot = visit.stock.find((entry) => entry.price <= state.currency);
        else {
          let scorer: ReturnType<typeof boonScorer> | undefined;
          let bestScore = 0;
          for (const entry of visit.stock) {
            if (entry.price > state.currency) continue;
            const score = (scorer ??= boonScorer(state))(entry.boon);
            if (score <= 0) continue;
            if (
              !slot ||
              score / entry.price > bestScore / slot.price ||
              (score / entry.price === bestScore / slot.price &&
                (entry.price < slot.price ||
                  (entry.price === slot.price && entry.slot.localeCompare(slot.slot) < 0)))
            ) {
              slot = entry;
              bestScore = score;
            }
          }
        }
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
        let boon: BoonId | undefined;
        if (config.policy === "random") boon = offers.length ? pick(offers) : undefined;
        else {
          let scorer: ReturnType<typeof boonScorer> | undefined;
          let bestScore = 0;
          for (const offer of offers) {
            const score = (scorer ??= boonScorer(state))(offer);
            if (
              score > bestScore ||
              (score > 0 && score === bestScore && boon && offer.localeCompare(boon) < 0)
            ) {
              boon = offer;
              bestScore = score;
            }
          }
        }
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
        if (stalled)
          return decision(
            { type: "abandon" },
            "Return home after ten turns without reaching a new low in enemy Health",
          );
        if (config.policy !== "random") return battle.choose(state);
        const choices = rankedBattleChoices(state);
        return choices.length
          ? pick(choices)
          : decision({ type: "endTurn" }, "No affordable playable card has a scored visible benefit");
      }
    }
  };
}
