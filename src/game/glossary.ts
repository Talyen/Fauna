export const GLOSSARY = [
  {
    term: "Health",
    definition:
      "A creature's remaining life. At zero health it is knocked out. Healing cannot exceed maximum health.",
  },
  {
    term: "Block",
    definition:
      "Absorbs incoming damage before health. Each point absorbs one damage and is spent. Remaining block expires at the start of your next turn.",
  },
  {
    term: "Mana",
    definition: "The shared resource spent to play action cards. Your team starts each turn with 3 mana.",
  },
  {
    term: "Action card",
    definition:
      "A card belonging to one creature. That creature acts when you play it. Its cost is paid from the shared mana pool.",
  },
  {
    term: "Attack",
    definition: "An action that deals damage to an enemy. Attack traits and marks modify its damage.",
  },
  {
    term: "Damage",
    definition:
      "Reduces block, then health. Physical, Fire, Ice, Lightning, Poison, Nature, and Light identify damage types; they currently have no resistance or status rules.",
  },
  {
    term: "Hit",
    definition:
      "An incoming damage action. Briartooth's passive retaliates only when the action removes health, not when block absorbs it entirely.",
  },
  {
    term: "Marks",
    definition:
      "A stack on an enemy. The next attack against it consumes all marks, adding 3 damage per mark. Marks last until consumed or the battle ends.",
  },
  {
    term: "Turn",
    definition:
      "Play cards using shared mana. Spending your last mana automatically resolves the enemy turn. You can also press End turn at any time without confirmation. Discard remaining hand cards; refill mana and draw 5 cards for the next turn.",
  },
  {
    term: "Battle",
    definition:
      "One encounter. Defeat every enemy to win. This prototype restores all teammate health after victory. Temporary block and marks do not carry into the next battle.",
  },
  {
    term: "Draw / discard",
    definition:
      "All teammates share one deck, hand, and discard pile. Played and unplayed end-of-turn cards go to discard. Shuffle discard into the draw pile when needed.",
  },
  {
    term: "Knockout",
    definition:
      "At zero health a creature cannot act or be healed during that battle. Its cards leave circulation. Losing all three teammates ends the expedition.",
  },
  {
    term: "Upgrade",
    definition:
      "Permanently adds 2 to a card's base effect for this expedition, up to three upgrades. Recruitment removes the outgoing creature's cards and upgrades.",
  },
  {
    term: "Intent",
    definition:
      "An enemy's next attack damage and chosen target. Enemies act in row order. If a target is knocked out before an enemy acts, it attacks the first living teammate instead.",
  },
] as const;
