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
    term: "Keyword XP",
    definition:
      "Playing an action card earns 1 XP for each of its keywords. Battle-end XP is permanent, including after defeat. Abandoning a battle banks the XP already earned without granting victory rewards.",
  },
  {
    term: "Talents",
    definition:
      "Keyword XP earns points for that keyword's talents. The first point takes 20 XP, then another 40, then 60. Complete each row to open the next. Talents apply immediately to every matching creature. Reset a category at any time to refund all its points while retaining XP.",
  },
  {
    term: "Reserves",
    definition:
      "Recruit up to six distinct species during an expedition. Choose three active creatures before each battle. Only the active three contribute cards. Select creatures across the active and reserve rows to swap them.",
  },
  {
    term: "Relics",
    definition:
      "Passive effects lasting for the current expedition. When offered, choose one of three or skip. Relics end with the expedition.",
  },
  {
    term: "Currency",
    definition: "Battle-earned currency is permanent. Spending will be added in a future update.",
  },
] as const;
