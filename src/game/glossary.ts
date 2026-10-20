import { KEYWORD_DEFINITIONS, KEYWORD_IDS } from "./keywords";

export const GLOSSARY = [
  {
    term: "Health",
    definition: KEYWORD_DEFINITIONS.health.description,
  },
  {
    term: "Block",
    definition: KEYWORD_DEFINITIONS.block.description,
  },
  {
    term: "Mana",
    definition: KEYWORD_DEFINITIONS.mana.description,
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
    definition: KEYWORD_DEFINITIONS.mark.description,
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
      "At zero health a creature cannot act or be healed during that battle. Its cards cannot be played or normally drawn. A living reserve can replace it. Losing every creature in the roster ends the expedition.",
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
      "Recruit up to five distinct species: three deployed and two reserves. Only deployed, living creatures provide passives. Swap freely during your turn through Swap; choose one deployed creature and one living reserve in either order. Their cards replace one another in their existing hand, draw, and discard positions. Health and effects persist, and swapping grants no extra draws or opening bonuses.",
  },
  {
    term: "Starting lineup",
    definition:
      "Your original draft supplies the starting three. Edit Lineup from the menu between battles if desired. Combat swaps do not change this saved lineup. New recruits join reserves; Begin battle deploys your saved three without asking you to choose again.",
  },
  {
    term: "Relics",
    definition:
      "Passive effects lasting for the current expedition. When offered, choose one of three or skip. Relics end with the expedition.",
  },
  {
    term: "Currency",
    definition: KEYWORD_DEFINITIONS.currency.description,
  },
  ...KEYWORD_IDS.filter(
    (id) =>
      KEYWORD_DEFINITIONS[id].availability === "active" &&
      !["health", "block", "mana", "mark", "currency"].includes(id),
  ).map((id) => ({ term: KEYWORD_DEFINITIONS[id].label, definition: KEYWORD_DEFINITIONS[id].description })),
] as const;
