import { talent } from "../talent-builder";
export const STUN_TALENTS = [
  talent("stun.guarded-counter", "Guarded Counter", 0),
  talent("stun.shatter-guard", "Shatter Guard", 0),
  talent("stun.exploit-weakness", "Exploit Weakness", 1),
  talent("stun.extended-stun", "Extended Stun", 1),
  talent("stun.jarring-blow", "Jarring Blow", 2),
  talent("stun.free-follow-up", "Free Follow-up", 2),
  talent("stun.concussive-force", "Concussive Force", 3),
  talent("stun.stun-insight", "Stun Insight", 3),
  talent("stun.stun-surge", "Stun Surge", 4),
] as const;
