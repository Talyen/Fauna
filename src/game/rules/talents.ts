import { freeze } from "immer";
/** Numeric authored Talent values shared by copy and executable policies. */
const talentModifiers = freeze(
  {
    "stun.free-follow-up": { state: "freeCard" },
    "nature.windstep": { state: "freeNature" },
    "light.divine-favor": { state: "freeLight" },
    "physical.riposte": { state: "riposte" },
    "bleed.parting-cut": { state: "partingCut" },
    "armor.bulwark": {
      amount: 2,
    },
    "armor.reactive-guard": {
      amount: 3,
    },
    "armor.last-stand": {
      percent: 25,
    },
    "armor.armored-surge": {
      percent: 10,
      amount: 6,
    },
    "armor.iron-guard": {
      percent: 10,
    },
    "armor.steadfast": {
      amount: 3,
    },
    "armor.purification": {
      percent: 10,
    },
    "armor.reinforced": {
      percent: 10,
    },
    "bleed.first-blood": {
      percent: 25,
    },
    "bleed.sanguine": {
      percent: 10,
    },
    "bleed.flay": {
      percent: 20,
    },
    "bleed.bleeding-out": {
      percent: 25,
    },
    "bleed.tainted-wound": {
      percent: 10,
    },
    "bleed.septic-shock": {
      percent: 10,
    },
    "bleed.bloodrush": {
      percent: 10,
    },
    "block.second-wind": {
      amount: 2,
    },
    "block.reinforce": {
      percent: 10,
    },
    "block.sacred-shield": {
      percent: 10,
    },
    "block.impact-guard": {
      percent: 10,
    },
    "block.weighted-guard": {
      percent: 10,
    },
    "block.sun-struck-shield": {
      percent: 30,
    },
    "block.footwork": {
      amount: 2,
    },
    "burn.smoke-screen": {
      amount: 2,
    },
    "burn.flash-fire": {
      percent: 10,
    },
    "burn.heat-exhaustion": {
      percent: 10,
    },
    "burn.smoldering": {
      percent: 10,
    },
    "dodge.lightfoot": {
      amount: 5,
    },
    "dodge.catch-breath": {
      amount: 1,
    },
    "dodge.thornstep": {
      amount: 1,
    },
    "dodge.clean-getaway": {
      amount: 1,
    },
    "dodge.open-flank": {
      amount: 2,
      state: "nextPhysical",
    },
    "dodge.finding-rhythm": {
      maximum: 70,
      state: "rhythm",
      amount: 5,
    },
    "dodge.perfect-timing": {
      amount: 2,
    },
    "freeze.bitter-cold": {
      percent: 10,
    },
    "freeze.glacial-barrier": {
      amount: 3,
    },
    "freeze.brittle-ice": {
      amount: 1,
    },
    "freeze.winter-s-grasp": {
      percent: 10,
    },
    "health.mending": {
      percent: 10,
    },
    "health.renewal": {
      amount: 2,
    },
    "health.last-resort": {
      percent: 25,
    },
    "health.desperate-guard": {
      amount: 6,
    },
    "health.will-to-live": {
      amount: 1,
    },
    "health.combat-surge": {
      amount: 4,
    },
    "health.vitality": {
      amount: 4,
    },
    "health.overflow": {
      percent: 25,
    },
    "health.last-gasp": {
      percent: 10,
    },
    "leech.deep-siphon": {
      amount: 1,
    },
    "leech.blood-debt": {
      percent: 10,
    },
    "leech.affliction-siphon": {
      percent: 10,
    },
    "leech.cull-the-weak": {
      percent: 25,
    },
    "leech.sanguine-overflow": {
      amount: 1,
    },
    "leech.bloodletting": {
      percent: 10,
    },
    "leech.mana-siphon": {
      percent: 10,
      amount: 1,
    },
    "leech.armor-siphon": {
      amount: 1,
    },
    "leech.virulent-leech": {
      percent: 10,
    },
    "light.faith-barrier": {
      percent: 10,
    },
    "light.purge": {
      percent: 10,
    },
    "light.prosperity": {
      percent: 1,
    },
    "light.scorching-light": {
      percent: 10,
    },
    "light.tithe": {
      percent: 10,
    },
    "light.radiant-guard": {
      percent: 10,
    },
    "mana.wellspring": {
      amount: 1,
    },
    "mana.dark-recovery": {
      amount: 1,
    },
    "mana.leyline-attunement": {
      amount: 1,
    },
    "mana.manaburn": {
      percent: 25,
    },
    "mana.arcane-frost": {
      percent: 25,
    },
    "mana.arcane-mending": {
      amount: 1,
    },
    "nature.bramblegrowth": {
      percent: 10,
    },
    "nature.overgrowth": {
      percent: 10,
    },
    "nature.thornskin": {
      percent: 10,
    },
    "nature.photosynthesis": {
      percent: 10,
    },
    "nature.briar-patch": {
      percent: 10,
    },
    "nature.toxic-pollen": {
      percent: 10,
    },
    "nature.verdant-cycle": {
      percent: 10,
    },
    "nature.entangle": {
      percent: 10,
    },
    "physical.heavy-blows": {
      percent: 10,
    },
    "physical.finish-him": {
      percent: 25,
    },
    "physical.lacerate": {
      percent: 10,
    },
    "poison.hemotoxin": {
      percent: 10,
    },
    "poison.corrosive": {
      amount: 1,
    },
    "poison.toxic-profit": {
      amount: 3,
    },
    "poison.paralytic-venom": {
      percent: 10,
    },
    "poison.virulent": {
      percent: 10,
    },
    "poison.venom-strike": {
      percent: 10,
    },
    "stun.guarded-counter": {
      amount: 4,
    },
    "stun.extended-stun": {
      amount: 1,
    },
    "stun.jarring-blow": {
      percent: 10,
    },
    "stun.concussive-force": {
      percent: 10,
    },
    "stun.stun-surge": {
      amount: 1,
    },
    "water.pressure": {
      amount: 1,
    },
    "water.seafoam": {
      amount: 2,
    },
    "water.high-tide": {
      percent: 25,
    },
    "water.erosion": {
      amount: 2,
    },
    "water.cleansing-current": {
      percent: 20,
      amount: 1,
    },
    "water.riptide": {
      percent: 20,
    },
  } as const,
  true,
);

export function talentRule<K extends keyof typeof talentModifiers>(id: K) {
  return talentModifiers[id];
}
