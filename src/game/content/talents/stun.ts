import { talent } from "../talent-builder";
export const STUN_TALENTS = [
  talent(
    "stun.guarded-counter",
    "Guarded Counter",
    0,
    (rule) => `Stunning an enemy grants ${rule.amount} Block if you have none`,
  ),
  talent("stun.shatter-guard", "Shatter Guard", 0, "Stunning an enemy removes all its Armor"),
  talent("stun.exploit-weakness", "Exploit Weakness", 1, "Stunned enemies take double damage"),
  talent("stun.extended-stun", "Extended Stun", 1, (rule) => `Stun effects last ${rule.amount} turn longer`),
  talent(
    "stun.jarring-blow",
    "Jarring Blow",
    2,
    (rule) => `Stun cards have a ${rule.percent}% chance to play twice`,
  ),
  talent("stun.free-follow-up", "Free Follow-up", 2, "When you Stun an enemy, your next card is free"),
  talent(
    "stun.concussive-force",
    "Concussive Force",
    3,
    (rule) => `Enemy Stun threshold is reduced by ${rule.percent} percentage points`,
  ),
  talent("stun.stun-insight", "Stun Insight", 3, "When you Stun an enemy, draw a card"),
  talent(
    "stun.stun-surge",
    "Stun Surge",
    4,
    (rule) => `If you have no Mana, Stunning an enemy grants ${rule.amount} Mana`,
  ),
] as const;
