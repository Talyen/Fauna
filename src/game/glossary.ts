import { KEYWORD_DEFINITIONS, KEYWORD_IDS } from "./keywords";

export const GLOSSARY = [
  {
    term: "Legendary",
    definition:
      "A creature deployed alone; Appears as an enemy only in Boss encounters; Can be recruited normally; Adds two copies of each ability to your deck",
  },
  {
    term: "Minion",
    definition:
      "A battle-only summon with its own Health; Has no cards or roster slot; Disappears when its summoner falls or leaves the field",
  },
  {
    term: "Echo",
    definition:
      "Memento's Minion; Has 6 Health before card upgrades; Attacks only through The Court Remembers; Up to two can be summoned",
  },
  {
    term: "Pearl",
    definition:
      "A battle-only card created in your hand; Costs 1 Mana; Randomly grants 2 Block or 2 Mana; Can be drawn and discarded normally",
  },
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
      "A card belonging to one creature; That creature acts when you play it; Its cost is paid from the shared mana pool",
  },
  {
    term: "Attack",
    definition: "An action that deals damage to an enemy; Attack traits modify its damage",
  },
  {
    term: "Damage",
    definition:
      "Attacks can Dodge or critically hit; Block absorbs damage first; Armor then reduces Physical and Stun damage; Positive damage removes 1 Armor; Burn, Poison, Bleed, Stun, and Freeze hits add their matching buildup; There are no elemental reactions",
  },
  {
    term: "Hit",
    definition:
      "A landed attack, including one absorbed by Block; Dodges and periodic damage are not hits; Sporecoat retaliates when hit; Thorns require the attack to remove Health",
  },
  {
    term: "Turn",
    definition:
      "Play cards using shared mana; Spending your last mana automatically resolves the enemy turn; You can also press End turn at any time without confirmation; Discard remaining hand cards; restore 4 Mana and draw 4 cards for the next turn; The hand holds 6; overflow waits in order and survives turn changes",
  },
  {
    term: "Death's Door",
    definition:
      "Each allied creature survives fatal damage once per battle at 1 Health, with 2 grace turns; Fatal packets during those grace turns still leave 1 Health; later damage can knock it out; Reserve turns also spend grace",
  },
  {
    term: "Battle",
    definition:
      "One encounter; Defeat every enemy to win; Health and knockouts persist between encounters; Campfire Rest restores 30% of each creature's maximum Health, including knocked-out creatures; Combat effects and Block reset for the next battle",
  },
  {
    term: "Draw / discard",
    definition:
      "All teammates share one deck, hand, and discard pile; Played and unplayed end-of-turn cards go to discard; Shuffle discard into the draw pile as soon as the draw pile is empty",
  },
  {
    term: "Copy",
    definition:
      "A duplicate of a drawn card with the same owner, level and Mana cost; Stays in the deck until battle end; Drawing a copy can copy it again; Creating or promoting a copy is not a draw",
  },
  {
    term: "Knockout",
    definition:
      "At zero health a creature cannot act or be healed during that battle; Its cards cannot be played or normally drawn; A living backup can replace it; Losing every creature in the roster ends the journey",
  },
  {
    term: "Keyword XP",
    definition:
      "Playing an action card earns 1 XP for each of its keywords; Battle-end XP is permanent, including after defeat; Abandoning a battle banks the XP already earned without granting victory rewards",
  },
  {
    term: "Talents",
    definition:
      "Keyword XP earns points for that keyword's talents; The first point takes 10 XP, then another 30, then 60; Complete each row to open the next; Talents apply immediately to every matching creature; Reset a category at any time to refund all its points while retaining XP",
  },
  {
    term: "Backup",
    definition:
      "Recruit up to five creatures: up to three ordinary creatures or one Legendary deployed; Only deployed living creatures provide passives; After a knockout, choose a living backup before continuing; Replacements preserve card slots and grant no extra draws or opening bonuses; Other swaps require abilities or game effects",
  },
  {
    term: "Swap cards",
    definition:
      "Swap with a random living backup; Remove the departing creature's cards from hand and all piles, then shuffle the incoming kit into the draw pile before any draws; With no living backup, swap positions with a random living ally; Alone, only the swap part does nothing; Safe Passage instead swaps the lowest Health ally and needs a living backup; Health and effects persist",
  },
  {
    term: "Starting lineup",
    definition:
      "Your draft supplies the initial formation; Knockout replacements and ability swaps update it for later battles; Recruits fill vacant ordinary positions before joining backup; Formation cannot be edited manually",
  },
  {
    term: "Boons",
    definition:
      "Passive effects lasting for the current journey; When offered, choose one of three or skip; Boons end with the journey",
  },
  {
    term: "Gold",
    definition:
      "Gold earned in battle carries between journeys; Spend Gold at Boon Merchants on Boons for the current journey; Gold is not a keyword or talent category",
  },
  ...KEYWORD_IDS.filter(
    (id) => KEYWORD_DEFINITIONS[id].availability === "active" && !["health", "block", "mana"].includes(id),
  ).map((id) => ({ term: KEYWORD_DEFINITIONS[id].label, definition: KEYWORD_DEFINITIONS[id].description })),
] as const;
