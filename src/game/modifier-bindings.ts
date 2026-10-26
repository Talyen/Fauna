import type {
  attackProcs,
  blockDepletionRewards,
  damageRewards,
  dodgeResponse,
  passingFlame,
  passiveRetaliation,
  waterFollowups,
} from "./combat/damage-reactions";
import type {
  applyHarmfulStatus,
  cleanseRewards,
  cleanseThorns,
  controlRewards,
  grantStatus,
  puzzleEffect,
  removeEffects,
  returnCleansedEffect,
  triggerArmorBreak,
} from "./combat/statuses";
import type { gentlePassage, mountainGuide, swapBackup } from "./team";
import { freeze } from "immer";
import type { TalentId, BoonId } from "./content";
import type { PassiveKind } from "./content/types";
import type {
  cardCost,
  manaCapacity,
  encoreProgressLimit,
  passiveCardBonus,
  physicalBonus,
  retainedBlock,
} from "./ability-rules";
import type {
  drawHasAnotherCard,
  expressDelivery,
  receiveDraw,
  lostAndFound,
  drawEligibleCard,
} from "./card-zones";
import type { loseHealth, openingCriticalBonus, ownDodgeChance, sharedDodgeChance } from "./combat/state";

type Modules = {
  "./team": {
    gentlePassage: typeof gentlePassage;
    mountainGuide: typeof mountainGuide;
    swapBackup: typeof swapBackup;
  };
  "./battlefield": typeof import("./battlefield");
  "./ability-facts": typeof import("./ability-facts");
  "./ability-rules": {
    metronomeActorValid: typeof import("./ability-rules").metronomeActorValid;
    actionValue: typeof import("./ability-rules").actionValue;
    puzzleProgressLimit: typeof import("./ability-rules").puzzleProgressLimit;
    cardCost: typeof cardCost;
    manaCapacity: typeof manaCapacity;
    encoreProgressLimit: typeof encoreProgressLimit;
    passiveCardBonus: typeof passiveCardBonus;
    physicalBonus: typeof physicalBonus;
    retainedBlock: typeof retainedBlock;
  };
  "./card-actors": typeof import("./card-actors");
  "./card-zones": {
    recoverBrokenGuard: typeof import("./card-zones").recoverBrokenGuard;
    lostAndFound: typeof lostAndFound;
    drawHasAnotherCard: typeof drawHasAnotherCard;
    expressDelivery: typeof expressDelivery;
    receiveDraw: typeof receiveDraw;
    drawEligibleCard: typeof drawEligibleCard;
  };
  "./chance": typeof import("./chance");
  "./combat/ability-modifiers": typeof import("./combat/ability-modifiers");
  "./combat/battle-modifiers": typeof import("./combat/battle-modifiers");
  "./combat/card-modifiers": typeof import("./combat/card-modifiers");
  "./combat/food": typeof import("./combat/food");
  "./combat/damage": typeof import("./combat/damage");
  "./combat/damage-reactions": {
    attackProcs: typeof attackProcs;
    blockDepletionRewards: typeof blockDepletionRewards;
    damageRewards: typeof damageRewards;
    dodgeResponse: typeof dodgeResponse;
    passingFlame: typeof passingFlame;
    passiveRetaliation: typeof passiveRetaliation;
    waterFollowups: typeof waterFollowups;
  };
  "./combat/damage-values": typeof import("./combat/damage-values");
  "./combat/healing-values": typeof import("./combat/healing-values");
  "./combat/interception": typeof import("./combat/interception");
  "./combat/legendary": typeof import("./combat/legendary");
  "./combat/lifecycle": typeof import("./combat/lifecycle");
  "./combat/protection": typeof import("./combat/protection");
  "./combat/state": {
    beginAttack: typeof import("./combat/state").beginAttack;
    loseHealth: typeof loseHealth;
    openingCriticalBonus: typeof openingCriticalBonus;
    ownDodgeChance: typeof ownDodgeChance;
    sharedDodgeChance: typeof sharedDodgeChance;
  };
  "./combat/statuses": {
    applyHarmfulStatus: typeof applyHarmfulStatus;
    cleanseRewards: typeof cleanseRewards;
    cleanseThorns: typeof cleanseThorns;
    controlRewards: typeof controlRewards;
    grantStatus: typeof grantStatus;
    puzzleEffect: typeof puzzleEffect;
    removeEffects: typeof removeEffects;
    returnCleansedEffect: typeof returnCleansedEffect;
    triggerArmorBreak: typeof triggerArmorBreak;
  };
  "./combat/turns": typeof import("./combat/turns");
  "./destinations": typeof import("./destinations");
};
type CallableName<M extends keyof Modules> = {
  [K in keyof Modules[M]]: Modules[M][K] extends (...args: never[]) => unknown ? K : never;
}[keyof Modules[M]];

// Only plain data crosses into content validation. The compiler verifies each
// named export; the source contract verifies its selector and production caller.
function bind<M extends keyof Modules, N extends CallableName<M>>(module: M, name: N) {
  return { module, name };
}
const owners = {
  lostAndFound: bind("./card-zones", "lostAndFound"),
  puzzleProgressLimit: bind("./ability-rules", "puzzleProgressLimit"),
  actionValue: bind("./ability-rules", "actionValue"),
  grantStatus: bind("./combat/statuses", "grantStatus"),
  puzzleEffect: bind("./combat/statuses", "puzzleEffect"),
  drawEligibleCard: bind("./card-zones", "drawEligibleCard"),
  swapBackup: bind("./team", "swapBackup"),
  encoreProgressLimit: bind("./ability-rules", "encoreProgressLimit"),
  wellProvisioned: bind("./combat/food", "wellProvisioned"),
  gentlePassage: bind("./team", "gentlePassage"),
  mountainGuide: bind("./team", "mountainGuide"),
  afterPlayerCard: bind("./combat/card-modifiers", "afterPlayerCard"),
  lastWarmth: bind("./combat/card-modifiers", "lastWarmth"),
  returnDodgedCard: bind("./combat/card-modifiers", "returnDodgedCard"),
  manaCapacity: bind("./ability-rules", "manaCapacity"),
  healingAllies: bind("./battlefield", "healingAllies"),
  removeEffects: bind("./combat/statuses", "removeEffects"),
  returnCleansedEffect: bind("./combat/statuses", "returnCleansedEffect"),
  consumeCardGrants: bind("./combat/card-modifiers", "consumeCardGrants"),
  applyHarmfulStatus: bind("./combat/statuses", "applyHarmfulStatus"),
  armorApplies: bind("./combat/damage-values", "armorApplies"),
  blockEfficiency: bind("./combat/damage-values", "blockEfficiency"),
  attackProcs: bind("./combat/damage-reactions", "attackProcs"),
  metronomeActorValid: bind("./ability-rules", "metronomeActorValid"),
  beginAttack: bind("./combat/state", "beginAttack"),
  recoverBrokenGuard: bind("./card-zones", "recoverBrokenGuard"),
  cleanseThorns: bind("./combat/statuses", "cleanseThorns"),
  negateAttack: bind("./combat/damage", "negateAttack"),
  battleMana: bind("./combat/battle-modifiers", "battleMana"),
  beforeAbility: bind("./combat/ability-modifiers", "beforeAbility"),
  blockDepletionRewards: bind("./combat/damage-reactions", "blockDepletionRewards"),
  bounce: bind("./combat/damage", "bounce"),
  cardCost: bind("./ability-rules", "cardCost"),
  chance: bind("./chance", "chance"),
  cleanseRewards: bind("./combat/statuses", "cleanseRewards"),
  controlRewards: bind("./combat/statuses", "controlRewards"),
  courtRemembers: bind("./combat/legendary", "courtRemembers"),
  passingFlame: bind("./combat/damage-reactions", "passingFlame"),
  damageRewards: bind("./combat/damage-reactions", "damageRewards"),
  decayBlock: bind("./combat/turns", "decayBlock"),
  dodgeResponse: bind("./combat/damage-reactions", "dodgeResponse"),
  drawHasAnotherCard: bind("./card-zones", "drawHasAnotherCard"),
  encore: bind("./combat/ability-modifiers", "encore"),
  enemyBattleStart: bind("./combat/battle-modifiers", "enemyBattleStart"),
  expressDelivery: bind("./card-zones", "expressDelivery"),
  gainMana: bind("./combat/protection", "gainMana"),
  grantArmor: bind("./combat/protection", "grantArmor"),
  grantBlock: bind("./combat/protection", "grantBlock"),
  healingBenefit: bind("./ability-facts", "healingBenefit"),
  healingValue: bind("./combat/healing-values", "healingValue"),
  healthThresholds: bind("./combat/protection", "healthThresholds"),
  hit: bind("./combat/damage", "hit"),
  interceptAttack: bind("./combat/interception", "interceptAttack"),
  kindlingFlourish: bind("./combat/ability-modifiers", "kindlingFlourish"),
  leechHealth: bind("./combat/protection", "leechHealth"),
  livingChorus: bind("./combat/turns", "livingChorus"),
  loseHealth: bind("./combat/state", "loseHealth"),
  merchantPriceRange: bind("./destinations", "merchantPriceRange"),
  modifiedDamage: bind("./combat/damage-values", "modifiedDamage"),
  openingCriticalBonus: bind("./combat/state", "openingCriticalBonus"),
  ordinaryAttackFacts: bind("./ability-facts", "ordinaryAttackFacts"),
  overflowBlock: bind("./combat/healing-values", "overflowBlock"),
  ownDodgeChance: bind("./combat/state", "ownDodgeChance"),
  passiveCardBonus: bind("./ability-rules", "passiveCardBonus"),
  passiveRetaliation: bind("./combat/damage-reactions", "passiveRetaliation"),
  physicalBonus: bind("./ability-rules", "physicalBonus"),
  playerBattleStart: bind("./combat/battle-modifiers", "playerBattleStart"),
  receiveDraw: bind("./card-zones", "receiveDraw"),
  renewalManaBonus: bind("./combat/battle-modifiers", "renewalManaBonus"),
  resolveHit: bind("./combat/damage", "resolveHit"),
  restoreHealth: bind("./combat/protection", "restoreHealth"),
  retainedBlock: bind("./ability-rules", "retainedBlock"),
  shareProtection: bind("./combat/protection", "shareProtection"),
  sharedDodgeChance: bind("./combat/state", "sharedDodgeChance"),
  startAction: bind("./combat/lifecycle", "startAction"),
  talentRepeat: bind("./combat/ability-modifiers", "talentRepeat"),
  tickStatuses: bind("./combat/lifecycle", "tickStatuses"),
  triggerArmorBreak: bind("./combat/statuses", "triggerArmorBreak"),
  unfinishedJourneyLimit: bind("./card-actors", "unfinishedJourneyLimit"),
  unhurried: bind("./combat/turns", "unhurried"),
  victoryGoldBonus: bind("./combat/battle-modifiers", "victoryGoldBonus"),
  victoryRecovery: bind("./combat/battle-modifiers", "victoryRecovery"),
  waterFollowups: bind("./combat/damage-reactions", "waterFollowups"),
};
type Implementation = (typeof owners)[keyof typeof owners];
type Binding = readonly [Implementation, ...Implementation[]];

// This is an ownership map, never an execution order or a runtime dispatcher.
export const modifierImplementations = freeze(
  {
    talents: {
      "armor.bulwark": [owners.playerBattleStart],
      "armor.reactive-guard": [owners.triggerArmorBreak],
      "armor.last-stand": [owners.grantArmor],
      "armor.armored-surge": [owners.beforeAbility],
      "armor.fireward": [owners.armorApplies],
      "armor.thick-hide": [owners.armorApplies],
      "armor.iron-guard": [owners.attackProcs],
      "armor.steadfast": [owners.healthThresholds],
      "armor.purification": [owners.grantArmor],
      "armor.reinforced": [owners.grantArmor],
      "bleed.first-blood": [owners.modifiedDamage],
      "bleed.mortal-wound": [owners.healingValue],
      "bleed.parting-cut": [owners.dodgeResponse, owners.resolveHit],
      "bleed.sanguine": [owners.attackProcs],
      "bleed.wound-care": [owners.modifiedDamage],
      "bleed.flay": [owners.attackProcs],
      "bleed.bleeding-out": [owners.modifiedDamage],
      "bleed.tainted-wound": [owners.attackProcs],
      "bleed.septic-shock": [owners.modifiedDamage],
      "bleed.bloodrush": [owners.attackProcs],
      "block.second-wind": [owners.blockDepletionRewards],
      "block.grounding": [owners.applyHarmfulStatus],
      "block.reinforce": [owners.blockEfficiency],
      "block.sacred-shield": [owners.modifiedDamage],
      "block.impact-guard": [owners.modifiedDamage],
      "block.weighted-guard": [owners.modifiedDamage],
      "block.sun-struck-shield": [owners.blockDepletionRewards],
      "block.footwork": [owners.dodgeResponse],
      "block.blood-ward": [owners.modifiedDamage],
      "block.venom-ward": [owners.modifiedDamage],
      "burn.flashpoint": [owners.cardCost],
      "burn.melting-point": [owners.resolveHit],
      "burn.smoke-screen": [owners.dodgeResponse],
      "burn.flash-fire": [owners.talentRepeat],
      "burn.heat-exhaustion": [owners.attackProcs],
      "burn.smoldering": [owners.tickStatuses],
      "burn.fire-resistance": [owners.modifiedDamage],
      "dodge.lightfoot": [owners.ownDodgeChance],
      "dodge.catch-breath": [owners.dodgeResponse],
      "dodge.thornstep": [owners.dodgeResponse],
      "dodge.clean-getaway": [owners.dodgeResponse],
      "dodge.open-flank": [owners.dodgeResponse, owners.resolveHit],
      "dodge.unburdened": [owners.dodgeResponse],
      "dodge.tailwind": [owners.dodgeResponse],
      "dodge.finding-rhythm": [owners.resolveHit, owners.dodgeResponse],
      "dodge.perfect-timing": [owners.dodgeResponse],
      "freeze.bitter-cold": [owners.applyHarmfulStatus],
      "freeze.glacial-barrier": [owners.applyHarmfulStatus],
      "freeze.brittle-ice": [owners.modifiedDamage],
      "freeze.winter-s-grasp": [owners.talentRepeat],
      "freeze.icebound": [owners.applyHarmfulStatus],
      "freeze.brittle-armor": [owners.applyHarmfulStatus],
      "freeze.cold-resistance": [owners.modifiedDamage],
      "freeze.cryo-preservation": [owners.tickStatuses],
      "freeze.thaw-dividend": [owners.startAction],
      "health.mending": [owners.healingValue],
      "health.renewal": [owners.cleanseRewards],
      "health.last-resort": [owners.healthThresholds],
      "health.desperate-guard": [owners.healthThresholds],
      "health.will-to-live": [owners.loseHealth],
      "health.combat-surge": [owners.playerBattleStart],
      "health.vitality": [owners.victoryRecovery],
      "health.overflow": [owners.restoreHealth],
      "health.last-gasp": [owners.ownDodgeChance],
      "health.clean-slate": [owners.restoreHealth],
      "leech.deep-siphon": [owners.leechHealth],
      "leech.desperate-siphon": [owners.leechHealth],
      "leech.blood-debt": [owners.leechHealth],
      "leech.affliction-siphon": [owners.leechHealth],
      "leech.cull-the-weak": [owners.modifiedDamage],
      "leech.sanguine-overflow": [owners.leechHealth],
      "leech.bloodletting": [owners.leechHealth],
      "leech.mana-siphon": [owners.leechHealth],
      "leech.armor-siphon": [owners.beforeAbility],
      "leech.virulent-leech": [owners.damageRewards, owners.attackProcs],
      "light.faith-barrier": [owners.attackProcs],
      "light.blessed-leech": [owners.resolveHit],
      "light.celestial-ward": [owners.modifiedDamage],
      "light.purge": [owners.modifiedDamage],
      "light.divine-favor": [owners.cleanseRewards, owners.consumeCardGrants],
      "light.prosperity": [owners.modifiedDamage],
      "light.scorching-light": [owners.attackProcs],
      "light.tithe": [owners.attackProcs],
      "light.radiant-guard": [owners.grantBlock],
      "mana.wellspring": [owners.renewalManaBonus],
      "mana.dark-recovery": [owners.renewalManaBonus],
      "mana.mana-bulwark": [owners.playerBattleStart],
      "mana.leyline-attunement": [owners.battleMana],
      "mana.manaburn": [owners.modifiedDamage],
      "mana.arcane-frost": [owners.modifiedDamage],
      "mana.mana-shell": [owners.playerBattleStart],
      "mana.arcane-mending": [owners.gainMana],
      "nature.bramblegrowth": [owners.attackProcs],
      "nature.ecosystem": [owners.playerBattleStart],
      "nature.overgrowth": [owners.talentRepeat],
      "nature.thornskin": [owners.attackProcs],
      "nature.photosynthesis": [owners.attackProcs],
      "nature.windstep": [owners.dodgeResponse, owners.consumeCardGrants],
      "nature.briar-patch": [owners.attackProcs],
      "nature.toxic-pollen": [owners.attackProcs],
      "nature.verdant-cycle": [owners.attackProcs],
      "nature.entangle": [owners.attackProcs],
      "physical.shield-slam": [owners.physicalBonus],
      "physical.armored-fists": [owners.physicalBonus],
      "physical.heavy-blows": [owners.attackProcs],
      "physical.finish-him": [owners.modifiedDamage],
      "physical.lacerate": [owners.attackProcs],
      "physical.rupture": [owners.attackProcs, owners.resolveHit],
      "physical.riposte": [owners.dodgeResponse, owners.resolveHit],
      "physical.unrelenting": [owners.modifiedDamage],
      "poison.necrosis": [owners.healingValue],
      "poison.torpor": [owners.ownDodgeChance],
      "poison.hemotoxin": [owners.attackProcs],
      "poison.corrosive": [owners.modifiedDamage],
      "poison.caustic": [owners.resolveHit],
      "poison.toxin-resistance": [owners.modifiedDamage],
      "poison.toxic-profit": [owners.damageRewards],
      "poison.paralytic-venom": [owners.attackProcs],
      "poison.virulent": [owners.tickStatuses],
      "poison.venom-strike": [owners.talentRepeat],
      "stun.guarded-counter": [owners.applyHarmfulStatus],
      "stun.shatter-guard": [owners.applyHarmfulStatus],
      "stun.exploit-weakness": [owners.modifiedDamage],
      "stun.extended-stun": [owners.applyHarmfulStatus],
      "stun.jarring-blow": [owners.talentRepeat],
      "stun.free-follow-up": [owners.applyHarmfulStatus, owners.consumeCardGrants],
      "stun.concussive-force": [owners.applyHarmfulStatus],
      "stun.stun-insight": [owners.applyHarmfulStatus],
      "stun.stun-surge": [owners.applyHarmfulStatus],
      "water.pressure": [owners.modifiedDamage],
      "water.seafoam": [owners.waterFollowups],
      "water.high-tide": [owners.modifiedDamage],
      "water.erosion": [owners.waterFollowups],
      "water.cleansing-current": [owners.waterFollowups],
      "water.riptide": [owners.waterFollowups],
    } satisfies Record<TalentId, Binding>,
    boons: {
      "grafting-needle": [owners.restoreHealth],
      "coral-net-weight": [owners.resolveHit],
      "moonveil-mask": [owners.beginAttack],
      "mercury-metronome": [owners.afterPlayerCard, owners.metronomeActorValid],
      "raincatcher-bowl": [owners.battleMana],
      "thunder-conch": [owners.controlRewards],
      "thistle-sieve": [owners.cleanseThorns],
      "crater-punch": [owners.resolveHit],
      "cloud-cup-and-ball": [owners.recoverBrokenGuard],
      "echo-lens": [owners.negateAttack],
      "apiary-smoker": [owners.grantStatus],
      "brookskip-disc": [owners.resolveHit],
      "fallingstar-anvil": [owners.resolveHit],
      "pleated-pagoda": [owners.decayBlock],
      "calendula-soap": [owners.cleanseRewards],
      "nectar-dipper": [owners.actionValue],
      "saddle-pouch": [owners.swapBackup],
      "dune-shuttle": [owners.receiveDraw],
      "story-puzzle-cube": [owners.puzzleEffect, owners.puzzleProgressLimit],
      "mineral-bookend": [owners.drawEligibleCard],
      "briar-racquet": [owners.dodgeResponse],
      "lovers-knot": [owners.restoreHealth],
      "thaw-spoon": [owners.restoreHealth],
      "cinder-fan": [owners.tickStatuses],
      "moss-oven-mitt": [owners.blockEfficiency],
      "encore-baton": [owners.afterPlayerCard, owners.encoreProgressLimit],
      "pruning-crescent": [owners.removeEffects],
      "knot-comb": [owners.tickStatuses],
      "rain-cape": [owners.resolveHit],
      "tuning-fork-charm": [owners.armorApplies],
      rainkeeper: [owners.manaCapacity],
      "dream-yo-yo": [owners.returnDodgedCard],
      "basalt-glass-bookmark": [owners.removeEffects],
      "wonder-domino": [owners.resolveHit],
      "furnace-prism": [owners.damageRewards],
      "last-threshold": [owners.restoreHealth],
      "camp-hammock": [owners.healingAllies],
      "honeycomb-frame": [owners.resolveHit],
      "undertow-castanets": [owners.applyHarmfulStatus],
      "orbit-armillary": [owners.returnCleansedEffect],
      "tattered-pages": [owners.playerBattleStart],
      "bone-charm": [owners.damageRewards],
      "ironwood-buckler": [owners.grantBlock],
      "icy-heart": [owners.controlRewards],
      meteorite: [owners.resolveHit],
      "sin-eaters-lantern": [owners.cleanseRewards],
      thunderstone: [owners.controlRewards],
      "groves-favor": [owners.restoreHealth],
      "brass-censer": [owners.damageRewards],
      "parasitic-bloom": [owners.damageRewards],
      "cutpurse-knife": [owners.damageRewards],
      "merchants-favor": [owners.merchantPriceRange],
      "plague-doctors-mask": [owners.tickStatuses],
      "sundering-charm": [owners.resolveHit],
      "resonant-chimes": [owners.afterPlayerCard],
      "smugglers-map": [owners.victoryGoldBonus],
      "frozen-pocketwatch": [owners.applyHarmfulStatus],
      "lucky-clover": [owners.damageRewards],
    } satisfies Record<BoonId, Binding>,
    passives: {
      lostAndFound: [owners.lostAndFound],
      lastWarmth: [owners.lastWarmth],
      sunthaw: [owners.cleanseRewards],
      wellProvisioned: [owners.wellProvisioned],
      gentlePassage: [owners.gentlePassage],
      passingFlame: [owners.passingFlame],
      mountainGuide: [owners.mountainGuide],
      petalwake: [owners.dodgeResponse],
      expressDelivery: [owners.expressDelivery],
      fallenLeaves: [owners.decayBlock],
      unfinishedJourney: [owners.unfinishedJourneyLimit],
      unhurried: [owners.unhurried],
      gallantry: [owners.interceptAttack],
      goodFortune: [owners.chance],
      courtRemembers: [owners.courtRemembers],
      wellRead: [owners.receiveDraw],
      livingChorus: [owners.livingChorus],
      tidalRegeneration: [owners.startAction],
      kindlingFlourish: [owners.kindlingFlourish],
      resonance: [owners.hit],
      wrongFoot: [owners.hit],
      teamBurnResistance: [owners.modifiedDamage],
      teamFreezeResistance: [owners.modifiedDamage],
      blockConversion: [owners.grantBlock],
      blockRetention: [owners.retainedBlock],
      cardBonus: [owners.passiveCardBonus],
      battleStart: [owners.enemyBattleStart, owners.playerBattleStart],
      poisonRetaliation: [owners.passiveRetaliation],
      dodgeBurn: [owners.dodgeResponse],
      encore: [owners.encore],
      earlyBird: [owners.openingCriticalBonus],
      armorBreak: [owners.triggerArmorBreak],
      blockBreak: [owners.passiveRetaliation],
      statusReflection: [owners.applyHarmfulStatus],
      shareProtection: [owners.shareProtection],
      shareDodge: [owners.sharedDodgeChance],
      bounce: [owners.bounce],
    } satisfies Record<PassiveKind, Binding>,
  },
  true,
);

// Visible approximations are declared separately from gameplay implementations.
export const modifierQueries = freeze(
  {
    talents: {
      "health.overflow": [owners.healingBenefit, owners.overflowBlock],
      "health.clean-slate": [owners.healingBenefit],
      "dodge.finding-rhythm": [owners.ownDodgeChance],
      "light.divine-favor": [owners.cardCost],
      "nature.windstep": [owners.cardCost],
      "stun.free-follow-up": [owners.cardCost],
    } satisfies Partial<Record<TalentId, Binding>>,
    boons: {
      "crater-punch": [owners.ordinaryAttackFacts],
      "tuning-fork-charm": [owners.armorApplies],
      "sundering-charm": [owners.ordinaryAttackFacts],
      rainkeeper: [owners.manaCapacity],
    } satisfies Partial<Record<BoonId, Binding>>,
    passives: {
      wellRead: [owners.drawHasAnotherCard],
    } satisfies Partial<Record<PassiveKind, Binding>>,
  },
  true,
);
