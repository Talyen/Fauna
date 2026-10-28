import { KEYWORD_DEFINITIONS, KEYWORD_IDS } from "./keywords";

export const GLOSSARY = [
  {
    id: "legendary",
    term: "Legendary",
    definition:
      "A creature deployed alone; Appears as an enemy only in Boss encounters; Can be recruited normally; Adds two copies of each ability to your deck",
  },
  {
    id: "minion",
    term: "Minion",
    definition:
      "A battle-only summon with its own Health; Has no cards or roster slot; Disappears when its summoner falls or leaves the field",
  },
  {
    id: "echo",
    term: "Echo",
    definition:
      "Memento's Minion; Has 6 Health before card upgrades; Attacks only through The Court Remembers; Up to two can be summoned",
  },
  {
    id: "pearl",
    term: "Pearl",
    definition:
      "A battle-only card created in your hand; Costs 1 Mana; Randomly grants 2 Block or 2 Mana; Consume removes it after play; Unplayed Pearls can be drawn and discarded normally",
  },
  {
    id: "keyword.health",
    term: "Health",
    definition: KEYWORD_DEFINITIONS.health.description,
  },
  {
    id: "keyword.block",
    term: "Block",
    definition: KEYWORD_DEFINITIONS.block.description,
  },
  {
    id: "keyword.mana",
    term: "Mana",
    definition: KEYWORD_DEFINITIONS.mana.description,
  },
  {
    id: "action-card",
    term: "Action card",
    definition:
      "A card belonging to one creature; That creature acts when you play it; Its cost is paid from the shared mana pool",
  },
  {
    id: "attack",
    term: "Attack",
    definition: "An action that deals damage to an enemy; Attack traits modify its damage",
  },
  {
    id: "damage",
    term: "Damage",
    definition:
      "Attacks can Dodge or critically hit; Block absorbs damage first; Armor then reduces Physical and Stun damage; Reducing damage removes 1 Armor; Burn, Poison, Bleed, Stun, and Freeze hits add their matching buildup; There are no elemental reactions",
  },
  {
    id: "hit",
    term: "Hit",
    definition:
      "A landed attack, including one absorbed by Block; Dodges and periodic damage are not hits; Thorns and Sporecoat retaliate when hit",
  },
  {
    id: "turn",
    term: "Turn",
    definition:
      "Play cards using shared mana; After playing a card or swapping, Auto-end turn ends the turn if enabled, mana is empty, no cards can be played and no replacement is pending; You can also press End turn at any time without confirmation; Discard remaining hand cards; restore 4 Mana and draw 4 cards for the next turn; The hand normally holds 6, or 7 with Facet Abacus; overflow waits in order and survives turn changes",
  },
  {
    id: "deaths-door",
    term: "Death's Door",
    definition:
      "Each allied creature survives fatal damage once per battle at 1 Health, with 2 grace turns; Fatal packets during those grace turns still leave 1 Health; later damage can knock it out; Reserve turns also spend grace",
  },
  {
    id: "battle",
    term: "Battle",
    definition:
      "One encounter; Defeat every enemy to win; Health and knockouts persist between encounters; Campfire Rest restores 30% of each creature's maximum Health, including knocked-out creatures; Combat effects and Block reset for the next battle",
  },
  {
    id: "draw-discard",
    term: "Draw / discard",
    definition:
      "All teammates share one deck, hand, and discard pile; Played cards go to discard unless they have Consume; Unplayed end-of-turn cards go to discard; Refill an empty draw pile from Discard at the start of your turn",
  },
  {
    id: "copy",
    term: "Copy",
    definition:
      "A duplicate of a drawn card with the same owner, level and Mana cost; Stays in the deck until battle end; Drawing a copy can copy it again; Creating or promoting a copy is not a draw",
  },
  {
    id: "knockout",
    term: "Knockout",
    definition:
      "At zero health a creature cannot act or be healed during that battle; Its cards cannot be played or normally drawn; A living backup can replace it; Losing every creature in the roster ends the journey",
  },
  {
    id: "keyword-xp",
    term: "Keyword XP",
    definition:
      "Playing an action card earns 1 XP for each of its keywords; Battle-end XP is permanent, including after defeat; Abandoning a battle banks the XP already earned without granting victory rewards",
  },
  {
    id: "talents",
    term: "Talents",
    definition:
      "Keyword XP earns points for that keyword's talents; The first point takes 10 XP, then another 30, then 60; Complete each row to open the next; Talents apply immediately to every matching creature; Reset a category at any time to refund all its points while retaining XP",
  },
  {
    id: "backup",
    term: "Backup",
    definition:
      "Recruit up to five creatures: up to three ordinary creatures or one Legendary deployed; Only deployed living creatures provide passives; After a knockout, choose a living backup before continuing; Replacements preserve card slots and grant no extra draws or opening bonuses; Other swaps require abilities or game effects",
  },
  {
    id: "swap-cards",
    term: "Swap cards",
    definition:
      "Swap with a random living backup; Remove the departing creature's cards from hand and all piles, then shuffle the incoming kit into the draw pile before any draws; With no living backup, swap positions with a random living ally; Alone, only the swap part does nothing; Safe Passage instead swaps the lowest Health ally and needs a living backup; Health and effects persist",
  },
  {
    id: "starting-lineup",
    term: "Starting lineup",
    definition:
      "Your draft supplies the initial formation; Knockout replacements and ability swaps update it for later battles; Recruits fill vacant ordinary positions before joining backup; Formation cannot be edited manually",
  },
  {
    id: "boons",
    term: "Boons",
    definition:
      "Passive effects lasting for the current journey; When offered, choose one of three or skip; Boons end with the journey",
  },
  {
    id: "gold",
    term: "Gold",
    definition:
      "Gold earned in battle carries between journeys; Spend Gold at Boon Merchants on Boons for the current journey; Gold is not a keyword or talent category",
  },
  ...KEYWORD_IDS.filter(
    (id) => KEYWORD_DEFINITIONS[id].availability === "active" && !["health", "block", "mana"].includes(id),
  ).map((id) => ({
    id: `keyword.${id}`,
    term: KEYWORD_DEFINITIONS[id].label,
    definition: KEYWORD_DEFINITIONS[id].description,
  })),
] as const;
