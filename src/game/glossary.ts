import { KEYWORD_DEFINITIONS, KEYWORD_IDS } from "./keywords";

export const GLOSSARY = [
  {
    id: "legendary",
    term: "Legendary",
    definition:
      "A creature that deploys alone and adds two copies of each ability to your deck; Can be recruited normally; Enemy Legendaries appear only in Boss encounters",
  },
  {
    id: "minion",
    term: "Minion",
    definition:
      "A summoned creature with its own Health but no cards or roster slot; Lasts only for the battle and disappears if its summoner falls or leaves the field",
  },
  {
    id: "echo",
    term: "Echo",
    definition:
      "Memento's Minion; Starts with 6 Health before card upgrades; Attacks only through The Court Remembers; Up to two can be summoned",
  },
  {
    id: "pearl",
    term: "Pearl",
    definition:
      "A temporary card created in your hand; Costs 1 Mana and randomly grants 2 Block or 2 Mana; Consumed when played; Unplayed Pearls discard and recycle normally",
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
      "A creature's ability card; Playing it makes that creature act and spends your team's shared Mana",
  },
  {
    id: "attack",
    term: "Attack",
    definition: "An action that deals damage to an enemy; Its traits determine which damage modifiers apply",
  },
  {
    id: "damage",
    term: "Damage",
    definition:
      "Block absorbs damage first; Armor then reduces Physical and Stun damage; Burn, Poison, Bleed, Stun and Freeze hits add matching buildup, even through Block; Different damage types do not trigger elemental reactions",
  },
  {
    id: "hit",
    term: "Hit",
    definition:
      "An attack that connects, even if Block absorbs all damage; Dodges and damage over time are not hits; Hit effects can trigger without Health loss",
  },
  {
    id: "turn",
    term: "Turn",
    definition:
      "Play cards with your team's shared Mana; End turn discards your hand and lets enemies act; Your next turn normally restores 4 Mana and draws 4 cards; The hand holds 6 cards, or 7 with Facet Abacus; Extra drawn cards wait for space in draw order, even across turns",
  },
  {
    id: "auto-end-turn",
    term: "Auto-end turn",
    definition:
      "Optional setting; After a card play or swap, ends your turn if you have no Mana, no playable cards and no pending replacement; You can always choose End turn without confirmation",
  },
  {
    id: "deaths-door",
    term: "Death's Door",
    definition:
      "Once per battle, each allied creature survives fatal damage at 1 Health and gains 2 grace turns; Fatal damage also leaves 1 Health during grace; Turns in backup still use up grace",
  },
  {
    id: "battle",
    term: "Battle",
    definition:
      "Defeat every enemy to win; Health and knockouts carry into later battles; Block and combat effects reset; Campfire Rest restores 30% maximum Health to each creature, including knocked-out creatures",
  },
  {
    id: "draw-discard",
    term: "Draw / discard",
    definition:
      "Your team shares a deck, hand and discard pile; Played cards go to discard unless Consumed, as do cards left in hand at turn end; Whenever the draw pile empties, shuffle discard into it",
  },
  {
    id: "copy",
    term: "Copy",
    definition:
      "A duplicate of a drawn card with the same owner, level and Mana cost; Lasts only for the battle; Drawing a copy can create another copy; Creating a copy or moving it from overflow into hand does not count as drawing",
  },
  {
    id: "knockout",
    term: "Knockout",
    definition:
      "At 0 Health, a creature cannot act or receive ordinary healing in battle; Its cards normally cannot be played or drawn; Choose a living backup to replace it; Losing your entire roster ends the journey",
  },
  {
    id: "keyword-xp",
    term: "Keyword XP",
    definition:
      "Each action card played earns 1 XP per eligible keyword; XP becomes permanent when battle ends, even after defeat or abandonment; Abandoning grants no victory rewards",
  },
  {
    id: "talents",
    term: "Talents",
    definition:
      "Keyword XP earns points for that keyword's talents; The first three points cost 10, 30 and 60 additional XP; Complete a row to unlock the next; Talents immediately affect all matching creatures; Reset a category to refund its points without losing XP",
  },
  {
    id: "backup",
    term: "Backup",
    definition:
      "Creatures in your roster but off the field; Your roster holds up to five creatures, with up to three ordinary creatures or one Legendary deployed; Only living deployed creatures provide passives; After a knockout, choose a living backup to continue; Replacements preserve card slots without extra draws or opening bonuses",
  },
  {
    id: "swap-cards",
    term: "Swap cards",
    definition:
      "Swap the acting creature with a random living backup; Remove its cards from hand and all piles, then shuffle the incoming creature's cards into the draw pile; Without a backup, swap positions with a random living ally; Alone, the swap has no effect; Safe Passage instead swaps the lowest-Health ally and requires a living backup; Health and effects carry through swaps",
  },
  {
    id: "starting-lineup",
    term: "Starting lineup",
    definition:
      "The creatures deployed at battle start; Your draft sets the initial lineup, and replacements and ability swaps update it for later battles; Recruits fill empty ordinary positions before joining backup; You cannot rearrange the lineup manually",
  },
  {
    id: "boons",
    term: "Boons",
    definition:
      "Passive effects for the current journey; Choose one of three when offered, or skip; All Boons end with the journey",
  },
  {
    id: "gold",
    term: "Gold",
    definition:
      "Permanent currency that carries between journeys; Spend it at Boon Merchants on Boons for the current journey",
  },
  ...KEYWORD_IDS.filter(
    (id) => KEYWORD_DEFINITIONS[id].availability === "active" && !["health", "block", "mana"].includes(id),
  ).map((id) => ({
    id: `keyword.${id}`,
    term: KEYWORD_DEFINITIONS[id].label,
    definition: KEYWORD_DEFINITIONS[id].description,
  })),
] as const;
