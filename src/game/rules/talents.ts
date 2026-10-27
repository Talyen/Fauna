import { freeze } from "immer";

// Copy and executable parameters share one authored definition.
function rule<const P extends object>(parameters: P, describe: (parameters: P) => string) {
  return { ...parameters, text: describe(parameters) };
}
function repeatRule(keyword: string, percent: number) {
  return rule({ percent }, (p) => `${keyword} cards have a ${p.percent}% chance to play twice`);
}
const talentModifiers = freeze(
  {
    "armor.bulwark": rule({ amount: 2 }, (p) => `Start each battle with ${p.amount} Armor`),
    "armor.reactive-guard": rule({ amount: 3 }, (p) => `Gain ${p.amount} Block when your Armor breaks`),
    "armor.last-stand": rule({ percent: 25 }, (p) => `Gain ${p.percent}% more Armor while below half Health`),
    "armor.armored-surge": rule(
      { percent: 10, amount: 6 },
      (p) => `Playing a Block card has a ${p.percent}% chance to grant ${p.amount} Armor`,
    ),
    "armor.fireward": { text: "Armor mitigates Burn damage taken" },
    "armor.thick-hide": { text: "Armor mitigates Bleed damage taken" },
    "armor.iron-guard": rule(
      { percent: 10 },
      (p) => `Dealing Physical damage has a ${p.percent}% chance to also grant that amount of Armor`,
    ),
    "armor.steadfast": rule(
      { amount: 3 },
      (p) => `When your Health falls below half, gain ${p.amount} Armor`,
    ),
    "armor.purification": rule(
      { percent: 10 },
      (p) => `Gaining Armor has a ${p.percent}% chance to Cleanse a harmful status effect`,
    ),
    "armor.reinforced": rule({ percent: 10 }, (p) => `${p.percent}% chance to double Armor gained`),
    "bleed.first-blood": rule(
      { percent: 25 },
      (p) => `Deal ${p.percent}% more Bleed damage against enemies that aren’t already Bleeding`,
    ),
    "bleed.mortal-wound": { text: "Bleeding enemies receive half as much healing" },
    "bleed.parting-cut": {
      state: "partingCut",
      text: "After you Dodge, your next Physical hit deals half its damage as additional Bleed damage",
    },
    "bleed.sanguine": rule({ percent: 10 }, (p) => `Bleed hits have a ${p.percent}% chance to Leech`),
    "bleed.wound-care": { text: "Take half Bleed damage" },
    "bleed.flay": rule({ percent: 20 }, (p) => `Bleed hits have a ${p.percent}% chance to halve enemy Armor`),
    "bleed.bleeding-out": rule(
      { percent: 25 },
      (p) => `Deal ${p.percent}% more Bleed damage while below half Health`,
    ),
    "bleed.tainted-wound": rule(
      { percent: 10 },
      (p) => `Bleed hits have a ${p.percent}% chance to deal half their damage as Poison damage`,
    ),
    "bleed.septic-shock": rule(
      { percent: 10 },
      (p) => `Bleeding enemies take ${p.percent}% more Poison damage`,
    ),
    "bleed.bloodrush": rule(
      { percent: 10 },
      (p) => `Dealing Bleed damage has a ${p.percent}% chance to draw a card`,
    ),
    "block.second-wind": rule({ amount: 2 }, (p) => `Restore ${p.amount} Health when your Block is depleted`),
    "block.grounding": { text: "Block prevents Stun buildup" },
    "block.reinforce": rule({ percent: 10 }, (p) => `Block absorbs ${p.percent}% more Physical damage`),
    "block.sacred-shield": rule(
      { percent: 10 },
      (p) => `Light damage is increased by ${p.percent}% of your Block`,
    ),
    "block.impact-guard": rule(
      { percent: 10 },
      (p) => `Stun damage is increased by ${p.percent}% of your Block`,
    ),
    "block.weighted-guard": rule(
      { percent: 10 },
      (p) => `Physical damage is increased by ${p.percent}% of your Block`,
    ),
    "block.sun-struck-shield": rule(
      { percent: 30 },
      (p) => `When attacks deplete your Block, reflect ${p.percent}% of Block lost as Light damage`,
    ),
    "block.footwork": rule({ amount: 2 }, (p) => `Gain ${p.amount} Block when you Dodge`),
    "block.blood-ward": { text: "Take half Bleed damage while you have Block" },
    "block.venom-ward": { text: "Take half Poison damage while you have Block" },
    "burn.flashpoint": { text: "Your first Burn each battle is free" },
    "burn.melting-point": { text: "Burn damage removes an equal amount of Armor" },
    "burn.smoke-screen": rule(
      { amount: 2 },
      (p) => `When you Dodge a Burning enemy, deal ${p.amount} Burn damage`,
    ),
    "burn.flash-fire": repeatRule("Burn", 10),
    "burn.heat-exhaustion": rule(
      { percent: 10 },
      (p) => `Burn hits have a ${p.percent}% chance to also deal Stun damage`,
    ),
    "burn.smoldering": rule({ percent: 10 }, (p) => `Burn has a ${p.percent}% chance to not decay`),
    "burn.fire-resistance": { text: "Take half Burn damage" },
    "dodge.lightfoot": rule({ amount: 5 }, (p) => `Gain ${p.amount}% Dodge chance`),
    "dodge.catch-breath": rule({ amount: 1 }, (p) => `Restore ${p.amount} Health when you Dodge`),
    "dodge.thornstep": rule({ amount: 1 }, (p) => `Gain ${p.amount} Thorns when you Dodge`),
    "dodge.clean-getaway": rule(
      { amount: 1 },
      (p) => `When you Dodge, remove ${p.amount} stack each of Burn, Poison, and Bleed from yourself`,
    ),
    "dodge.open-flank": rule(
      { amount: 2, state: "nextPhysical" },
      (p) => `When you Dodge, your next attack deals ${p.amount} additional Physical damage`,
    ),
    "dodge.unburdened": { text: "When you Dodge, cleanse your Stun and Freeze buildup" },
    "dodge.tailwind": { text: "When you Dodge, draw a card" },
    "dodge.finding-rhythm": rule(
      { maximum: 70, state: "rhythm", amount: 5 },
      (p) => `Taking damage increases your Dodge chance by ${p.amount}%, resetting when you Dodge`,
    ),
    "dodge.perfect-timing": rule(
      { amount: 2 },
      (p) => `When you Dodge without Armor, gain ${p.amount} Armor`,
    ),
    "freeze.bitter-cold": rule(
      { percent: 10 },
      (p) => `Reduce enemy Freeze thresholds by ${p.percent} percentage points`,
    ),
    "freeze.glacial-barrier": rule({ amount: 3 }, (p) => `Gain ${p.amount} Block when you Freeze an enemy`),
    "freeze.brittle-ice": rule({ amount: 1 }, (p) => `Frozen enemies take ${p.amount} additional damage`),
    "freeze.winter-s-grasp": repeatRule("Freeze", 10),
    "freeze.icebound": { text: "When you Freeze an enemy, remove all its Block" },
    "freeze.brittle-armor": { text: "When you Freeze an enemy, remove all its Armor" },
    "freeze.cold-resistance": { text: "Take half Freeze damage" },
    "freeze.cryo-preservation": { text: "Poison does not decay on Frozen enemies" },
    "freeze.thaw-dividend": { text: "When an enemy recovers from Freeze, draw a card" },
    "health.mending": rule({ percent: 10 }, (p) => `Receive ${p.percent}% more healing during combat`),
    "health.renewal": rule({ amount: 2 }, (p) => `Cleansing a harmful status restores ${p.amount} Health`),
    "health.last-resort": rule(
      { percent: 25 },
      (p) => `When your Health falls below ${p.percent}%, cleanse all harmful status effects`,
    ),
    "health.desperate-guard": rule(
      { amount: 6 },
      (p) => `The first time your Health falls below half each combat, gain ${p.amount} Block`,
    ),
    "health.will-to-live": rule({ amount: 1 }, (p) => `Death's Door lasts ${p.amount} turn longer`),
    "health.combat-surge": rule({ amount: 4 }, (p) => `Restore ${p.amount} Health at the start of combat`),
    "health.vitality": rule({ amount: 4 }, (p) => `Restore ${p.amount} Health after every combat`),
    "health.overflow": rule(
      { percent: 25 },
      (p) => `Gain ${p.percent}% of excess healing from cards as Block`,
    ),
    "health.last-gasp": rule(
      { percent: 10 },
      (p) => `While below half Health, gain ${p.percent}% Dodge chance`,
    ),
    "health.clean-slate": {
      text: "When a card restores Health beyond your maximum, cleanse a harmful status effect",
    },
    "leech.deep-siphon": rule({ amount: 1 }, (p) => `Leech restores ${p.amount} additional Health`),
    "leech.desperate-siphon": { text: "Double Leech healing while below half Health" },
    "leech.blood-debt": rule(
      { percent: 10 },
      (p) => `Leech has a ${p.percent}% chance to also grant Gold equal to Health restored`,
    ),
    "leech.affliction-siphon": rule(
      { percent: 10 },
      (p) => `Leech restores ${p.percent}% more Health against Poisoned or Bleeding enemies`,
    ),
    "leech.cull-the-weak": rule(
      { percent: 25 },
      (p) => `Leech cards deal ${p.percent}% more damage against enemies below half Health`,
    ),
    "leech.sanguine-overflow": rule(
      { amount: 1 },
      (p) => `When Leech fills your Health, gain ${p.amount} Mana`,
    ),
    "leech.bloodletting": rule(
      { percent: 10 },
      (p) => `Leech has a ${p.percent}% chance to cleanse a harmful status`,
    ),
    "leech.mana-siphon": rule(
      { percent: 10, amount: 1 },
      (p) => `Leech has a ${p.percent}% chance to gain ${p.amount} Mana`,
    ),
    "leech.armor-siphon": rule(
      { amount: 1 },
      (p) => `Your Leech cards steal ${p.amount} Armor before their effects resolve`,
    ),
    "leech.virulent-leech": rule({ percent: 10 }, (p) => `Poison damage has a ${p.percent}% chance to Leech`),
    "light.faith-barrier": rule(
      { percent: 10 },
      (p) => `Light hits have a ${p.percent}% chance to grant Block equal to enemy Health lost`,
    ),
    "light.blessed-leech": { text: "Light damage: Leech below half Health" },
    "light.celestial-ward": { text: "Take half Light damage" },
    "light.purge": rule(
      { percent: 10 },
      (p) => `Light damage is increased by ${p.percent}% against Burning enemies`,
    ),
    "light.divine-favor": {
      state: "freeLight",
      text: "When you cleanse a harmful status effect, your next Light card is free",
    },
    "light.prosperity": rule(
      { percent: 1 },
      (p) => `Light damage is increased by ${p.percent}% of your Gold`,
    ),
    "light.scorching-light": rule(
      { percent: 10 },
      (p) => `Light damage has a ${p.percent}% chance to also deal Burn damage`,
    ),
    "light.tithe": rule(
      { percent: 10 },
      (p) => `Light damage has a ${p.percent}% chance to grant Gold equal to enemy Health lost`,
    ),
    "light.radiant-guard": rule(
      { percent: 10 },
      (p) => `Gaining Block has a ${p.percent}% chance to draw a Light card`,
    ),
    "mana.wellspring": rule(
      { amount: 1 },
      (p) => `End your turn with unspent Mana to gain ${p.amount} extra Mana next turn`,
    ),
    "mana.dark-recovery": rule(
      { amount: 1 },
      (p) => `End your turn with no Mana to gain ${p.amount} extra Mana next turn`,
    ),
    "mana.mana-bulwark": { text: "Start each combat with Block equal to your maximum Mana" },
    "mana.leyline-attunement": rule({ amount: 1 }, (p) => `Gain ${p.amount} maximum Mana each battle`),
    "mana.manaburn": rule({ percent: 25 }, (p) => `Burn damage is increased by ${p.percent}% of your Mana`),
    "mana.arcane-frost": rule(
      { percent: 25 },
      (p) => `Freeze damage is increased by ${p.percent}% of your Mana`,
    ),
    "mana.mana-shell": { text: "Start each combat with Armor equal to your maximum Mana" },
    "mana.arcane-mending": rule(
      { amount: 1 },
      (p) => `Each living deployed creature restores ${p.amount} Health per Mana gained`,
    ),
    "nature.bramblegrowth": rule(
      { percent: 10 },
      (p) => `Nature hits have a ${p.percent}% chance to grant Thorns equal to damage dealt`,
    ),
    "nature.ecosystem": { text: "Draw a Nature card at battle start" },
    "nature.overgrowth": repeatRule("Nature", 10),
    "nature.thornskin": rule(
      { percent: 10 },
      (p) => `Nature damage has a ${p.percent}% chance to also grant Armor`,
    ),
    "nature.photosynthesis": rule(
      { percent: 10 },
      (p) => `Nature damage has a ${p.percent}% chance to also restore Health`,
    ),
    "nature.windstep": { state: "freeNature", text: "When you Dodge, your next Nature card is free" },
    "nature.briar-patch": rule(
      { percent: 10 },
      (p) => `Nature damage has a ${p.percent}% chance to also deal Bleed damage`,
    ),
    "nature.toxic-pollen": rule(
      { percent: 10 },
      (p) => `Nature damage has a ${p.percent}% chance to also deal Poison damage`,
    ),
    "nature.verdant-cycle": rule({ percent: 10 }, (p) => `Nature damage has a ${p.percent}% chance to Leech`),
    "nature.entangle": rule(
      { percent: 10 },
      (p) => `Nature damage has a ${p.percent}% chance to also deal Stun damage`,
    ),
    "physical.shield-slam": { text: "Add half your Block to Physical damage" },
    "physical.armored-fists": { text: "Add half your Armor to Physical damage" },
    "physical.heavy-blows": rule(
      { percent: 10 },
      (p) => `Physical damage has a ${p.percent}% chance to also deal Stun damage`,
    ),
    "physical.finish-him": rule(
      { percent: 25 },
      (p) => `Physical damage is doubled against enemies below ${p.percent}% Health`,
    ),
    "physical.lacerate": rule({ percent: 10 }, (p) => `Physical damage has a ${p.percent}% chance to Bleed`),
    "physical.rupture": { text: "Physical critical hits detonate Bleed" },
    "physical.riposte": {
      state: "riposte",
      text: "After you Dodge, your next Physical attack is guaranteed to Critical Hit",
    },
    "physical.unrelenting": { text: "Physical damage is doubled while you're below half Health" },
    "poison.necrosis": { text: "Poisoned enemies receive half as much healing" },
    "poison.torpor": { text: "Poisoned enemies cannot Dodge" },
    "poison.hemotoxin": rule(
      { percent: 10 },
      (p) => `Poison has a ${p.percent}% chance to also deal Bleed damage`,
    ),
    "poison.corrosive": rule({ amount: 1 }, (p) => `Poisoned enemies take ${p.amount} additional damage`),
    "poison.caustic": { text: "Poison damage removes enemy Armor equal to damage dealt" },
    "poison.toxin-resistance": { text: "Take half Poison damage" },
    "poison.toxic-profit": rule(
      { amount: 3 },
      (p) => `Gain ${p.amount} Gold when you defeat a Poisoned enemy`,
    ),
    "poison.paralytic-venom": rule(
      { percent: 10 },
      (p) => `Poison damage has a ${p.percent}% chance to also deal Stun damage`,
    ),
    "poison.virulent": rule(
      { percent: 10 },
      (p) => `Poison has a ${p.percent}% chance to gain instead of lose a stack`,
    ),
    "poison.venom-strike": repeatRule("Poison", 10),
    "stun.guarded-counter": rule(
      { amount: 4 },
      (p) => `Stunning an enemy grants ${p.amount} Block if you have none`,
    ),
    "stun.shatter-guard": { text: "Stunning an enemy removes all its Armor" },
    "stun.exploit-weakness": { text: "Stunned enemies take double damage" },
    "stun.extended-stun": rule({ amount: 1 }, (p) => `Stun effects last ${p.amount} turn longer`),
    "stun.jarring-blow": repeatRule("Stun", 10),
    "stun.free-follow-up": {
      state: "freeCard",
      text: "When you Stun an enemy, your next card is free",
    },
    "stun.concussive-force": rule(
      { percent: 10 },
      (p) => `Enemy Stun threshold is reduced by ${p.percent} percentage points`,
    ),
    "stun.stun-insight": { text: "When you Stun an enemy, draw a card" },
    "stun.stun-surge": rule(
      { amount: 1 },
      (p) => `If you have no Mana, Stunning an enemy grants ${p.amount} Mana`,
    ),
    "water.pressure": rule({ amount: 1 }, (p) => `Water attacks deal ${p.amount} more damage`),
    "water.seafoam": rule({ amount: 2 }, (p) => `Water hits grant ${p.amount} Block`),
    "water.high-tide": rule(
      { percent: 25 },
      (p) => `Water attacks deal ${p.percent}% more damage while you have Block`,
    ),
    "water.erosion": rule({ amount: 2 }, (p) => `Water hits remove ${p.amount} Armor`),
    "water.cleansing-current": rule(
      { percent: 20, amount: 1 },
      (p) => `Water hits have a ${p.percent}% chance to Cleanse ${p.amount} harmful effect from you`,
    ),
    "water.riptide": rule(
      { percent: 20 },
      (p) => `Water hits have a ${p.percent}% chance to draw a Water card`,
    ),
  } as const,
  true,
);

export type TalentRuleId = keyof typeof talentModifiers;
export function talentRule<K extends TalentRuleId>(id: K) {
  return talentModifiers[id];
}
