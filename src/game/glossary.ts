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
    definition: "An action that deals damage to an enemy. Attack traits modify its damage.",
  },
  {
    term: "Damage",
    definition:
      "Attacks can Dodge or critically hit. Block absorbs damage first; Armor then reduces Physical and Stun damage. Positive damage removes 1 Armor. Burn, Poison, Bleed, Stun, and Freeze hits add their matching buildup. There are no elemental reactions.",
  },
  {
    term: "Hit",
    definition:
      "An incoming damage action. Briartooth's passive retaliates only when the action removes health, not when block absorbs it entirely.",
  },
  {
    term: "Turn",
    definition:
      "Play cards using shared mana. Spending your last mana automatically resolves the enemy turn. You can also press End turn at any time without confirmation. Discard remaining hand cards; restore 4 Mana and draw 4 cards for the next turn. The hand holds 7; overflow waits in order and survives turn changes.",
  },
  {
    term: "Death's Door",
    definition:
      "Each allied creature survives fatal damage once per battle at 1 Health, with 2 grace turns. Fatal packets during those grace turns still leave 1 Health; later damage can knock it out. Reserve turns also spend grace.",
  },
  {
    term: "Battle",
    definition:
      "One encounter. Defeat every enemy to win. Health and knockouts persist between destinations. Campfire Rest restores 30% of each creature's maximum Health, including knocked-out creatures. Combat effects and Block reset for the next battle.",
  },
  {
    term: "Draw / discard",
    definition:
      "All teammates share one deck, hand, and discard pile. Played and unplayed end-of-turn cards go to discard. Shuffle discard into the draw pile when needed.",
  },
  {
    term: "Knockout",
    definition:
      "At zero health a creature cannot act or be healed during that battle. Its cards cannot be played or normally drawn. A living reserve can replace it. Losing every creature in the roster ends the journey.",
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
    term: "Boons",
    definition:
      "Passive effects lasting for the current journey. When offered, choose one of three or skip. Boons end with the journey.",
  },
  {
    term: "Currency",
    definition:
      "Battle-earned currency is permanent. Gold is a currency, not a keyword or talent category. Spending is not implemented.",
  },
  ...KEYWORD_IDS.filter(
    (id) => KEYWORD_DEFINITIONS[id].availability === "active" && !["health", "block", "mana"].includes(id),
  ).map((id) => ({ term: KEYWORD_DEFINITIONS[id].label, definition: KEYWORD_DEFINITIONS[id].description })),
] as const;
