/** Approved October 25 additions; direct behavior regressions live in boons.test.ts. */
export const NEW_BOON_EFFECTS = {
  "briar-racquet": "Thorns retaliates at half strength when you Dodge",
  "lovers-knot": "Healing an ally also heals yourself",
  "thaw-spoon": "Healing removes an equal amount of Freeze buildup",
  "cinder-fan": "Enemy Burn lost through decay deals that much Burn damage, split between other enemies",
  "moss-oven-mitt": "Block is twice as effective against Burn",
  "encore-baton": "Draw a card after playing three",
  "pruning-crescent": "Purging enemy Thorns steals them for yourself",
  "knot-comb": "Cleanse a random harmful effect each turn",
  "rain-cape": "Water damage does not remove allied Armor",
  "tuning-fork-charm": "Physical hits ignore Armor on enemies with Stun buildup",
} as const;
