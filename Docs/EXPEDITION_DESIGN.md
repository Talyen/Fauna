# Journey progression — design decisions

These are the agreed directions from the design review. They supersede the prototype's choice between recruiting an immediate replacement and adding +2 to one card. The approved direction is implemented in gameplay. Isolated design samples remain available for comparison.

## Roster and battles

- Begin with one chosen starter. A journey roster grows to five creatures: up to three deployed and two reserves. Multiple copies of a species are allowed.
- Starter selection uses a three-column artwork grid of unlocked species. Clicking opens inspection with a Choose action; choosing returns to the grid and marks the selected creature. Begin journey is a separate action, available after choosing one starter. Inspecting or canceling never changes the choice. Choosing another replaces it.
- The starter supplies the remembered starting lineup. Recruits fill its second and third slots before joining reserves. The encounter screen offers one Combat or Boss placeholder ArtCard; inspection reveals the exact enemy group and Begin battle. Deck remains available without requiring team selection.
- Lineup is an optional menu dialog between battles, including ordinary reward screens. Changes save immediately. Combat swaps do not overwrite this starting lineup.
- Only deployed living creatures act and provide passive traits. Enemy intents remain hidden.
- During your turn, Swap opens a centered dialog with three deployed creatures and two reserves at the shared artwork size. Reserves are hidden on the battlefield.
- Select either creature first, then one from the opposite group to commit immediately. Swaps are free and unlimited; no Mana, draw, shuffle, turn advancement, or confirmation.
- A swap replaces the outgoing owner's three cards in their existing hand, draw, and discard positions. Spent cards stay spent. Legacy upgrades do not transfer to incoming creatures.
- Creature identity, health, Block, and first-attack state stay with the creature. Normal turn expiration applies in reserve; swapping never heals, cleanses, or repeats opening bonuses.
- Living reserves can replace knocked-out deployed creatures. Fallen creatures remain unavailable for the battle.
- If the deployed row falls, remaining enemy attacks stop and the next player turn begins with restored Mana. Healthy reserves can still enter through Swap. Defeat requires the whole roster to fall.
- Knocked-out card slots remain inert in saved battle zones and are skipped by ordinary draws. When the entire deployed row falls, the next hand reserves slots for incoming creatures so recovery does not require a free extra draw. These slots never render as playable cards for knocked-out owners.
- Victory preserves roster Health and knockouts. The next battle deploys the saved starting lineup; combat effects reset.
- Recruitment at five requires choosing one creature to release, or skipping. Replacing a starting creature updates that individual’s lineup entry.

## Biomes and encounters

- New journeys travel through Fernwood, then Moonwater Marsh. Each biome has three ordinary encounters followed by its boss; only the final boss completes the journey and unlocks Moonhart.
- Each step has one saved encounter: Combat for the three ordinary battles, then Boss. Enemy packs are selected from the current biome when advancing and remain unchanged through inspection, support visits and reload. Both encounter types use blank landscape placeholder artwork, with names beneath. Campfire appears alongside the encounter whenever any roster creature, including a reserve or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns without advancing the encounter or changing RNG. It remains available while the threshold is met.
- Combat and Boss use blank 4:3 artwork with the encounter type below it. Campfire uses Rest beneath its location art; entering it commits a saved visit and exposes Rest as its only option. A quiet heading shows the biome and current encounter within it.
- Opening Combat or Boss is inspection. Show its exact enemy group; inspect each creature's battle health and collectible kit in the same dialog. Back/Escape returns action → creature → encounter → encounter screen. Begin battle starts the saved encounter.
- Seeded gameplay chooses and saves one enemy pack when entering the encounter screen. Inspection, cancellation, menus, and reload never reroll enemies or consume randomness.
- Biome pools contain themed enemy packs that vary between runs. Initial enemy stats grow with chapter progress, with easier first encounters for a single starter. These values are playtest tuning, not final balance.

## Keyword XP and talents

- Creature XP, training levels, and milestone upgrades are retired design directions.
- Permanent keyword XP and talents replace creature training, taking Alchemy's keyword progression as a reference.
- Keyword progression is shared across the collection. Talents benefit any creature using the relevant keyword, rather than belonging to individual species.
- Each accepted card play earns 1 XP for each eligible keyword on that card, regardless of effect magnitude. A Fire + Block card earns 1 Fire XP and 1 Block XP.
- Earned keyword XP becomes permanent after each battle, including defeat.
- Talents are accessible through the main menu at any time. Purchases take effect immediately, including during a journey.
- Do not interrupt journeys or prompt players to spend talent points.
- Talents mix straightforward stat bonuses with new interactions and combo effects. Specific effects are not yet selected.
- Every talent can eventually be unlocked; there is no limited active-talent loadout.
- Each category currently offers two talents in one row; choose either first and eventually unlock both.
- The Talents screen opens on a keyword artwork overview, following Alchemy. Selecting a keyword opens its dedicated tree; Back returns to the overview.
- Each talent shows its icon, name, and full effect directly on the talent. Effects use concise rules with ownership implied where clear. All talents have distinct effects; do not repeat a shared talent set across keywords.
- Clicking an available talent purchases it immediately, without a detail-dialog purchase step or confirmation.
- Reset operates on the entire keyword category, refunding all spent points in that category while retaining its XP. Reset is available at any time, including during a journey; talent effects update immediately. Individual-talent refunds are not the chosen interaction.
- Use Alchemy’s current point pacing: cumulative thresholds are 10, 40, 100, 180, and 280 keyword XP. Total XP for point n is 10 × n × (n + 1) − 10 × min(n, 2). This is initial tuning for playtesting.
- Fourteen consolidated categories each have two distinct talents (28 total), adapted from Alchemy. Fire/Burn, Ice/Freeze and Lightning/Stun share progression; Thorns belongs to Nature, Cleanse to Healing, and Purge to Light. Forge is removed. The authored catalog and effects are owned by `src/game/progression.ts` and `src/game/combat.ts`.
- Abandonment banks the XP earned by accepted plays, with no victory currency or boons. Auto-play dispatches ordinary accepted plays; each awards keyword XP once. There are no repeated card-play effects.

## Recruitment

- Recruit from defeated enemy species after an ordinary combat victory.
- Recruiting adds a creature to the journey roster rather than forcing an immediate active-team replacement.
- Each ordinary combat contains three enemies. Choose a Recruit shows those exact three entries in battle order, including repeated species and species already in the roster. Recruiting creates a new individual with independent identity and battle state.
- Recruitment remains a direct commitment on the final choice, without a separate confirmation.
- Recruit one defeated creature or skip recruitment.
- When the roster is full, choose the incoming species, then choose an existing creature to release. The final replacement choice commits immediately; canceling before that choice preserves the roster.

## Currency and items

- All Gold is permanent and carries between journeys.
- Currency funds meta progression. Specific purchases are **TBD**.
- Each biome offers a Merchant after its first ordinary victory when an item is affordable. Buy one of up to two unowned journey Boons for 20 Gold, or Leave. Currency spending is atomic and reduces the wallet, while journey earnings remain gross retained income.
- Initial battle item rewards focus on run-wide boons: passive effects for the whole journey.
- When a battle awards a Boon, offer up to three distinct unowned choices.
- Choose one boon or skip the reward. Boons use 3:4 portrait artwork wherever displayed, matching hand cards. All eight Boons use copied Alchemy artwork; names stay below the art and effects in hover/focus tooltips. Owned Boons are inspectable from the menu during a journey.
- Starter tuning: Currency pays 20 per ordinary victory and 40 for each biome boss. Intermediate biome bosses offer up to three distinct unowned Boons; smaller nonempty pools remain available. Ordinary combat offers recruitment, never boons; intermediate bosses offer boons, never recruitment. Eight Boons are authored in `src/game/progression.ts`; their ownership lasts only for the journey. Material types and permanent upgrade purchases remain undefined.

## Screen flow and Journey results

Journey is the player-facing name. Internal command IDs, route fields, filenames, and storage paths retain their existing names.

Ordinary victory → shared Victory screen with recruitment (if available) → the next encounter. Intermediate boss victory → the same Victory screen with boon choices (if available) → the next biome. Compact last-battle currency and keyword XP earnings appear beside choices and remain visible on the encounter screen until the next battle. No separate acknowledgement screen interrupts new journeys. If neither decision is available, proceed directly to the next encounter.

Final victory or defeat → Journey results. Ending a started journey voluntarily also opens results, labeled Returned home. Ending an unfinished starter choice simply returns to the main menu.

- Results show only the outcome, keyword XP and permanent currencies/resources/items earned. Do not show the team, creature unlocks, journey-only boons, location, or journey statistics. Currency is the only authored permanent resource currently; do not invent item or material rewards.
- Keyword totals include all settled battles and XP banked when returning home. Follow Alchemy’s results presentation: keyword name, level (earned points + 1), and progress bar only. Hide numeric XP gains/fractions and points-earned lines here; the Talents screen owns point availability. Fauna uses the current 10/40/100 total XP thresholds. Talents remain menu-driven; never prompt purchases here.
- Banking and totals update atomically with accepted gameplay commands. Browsing results never grants rewards or saves. Report actual retained earnings at progression caps.
- Results offer a single centered Main menu action. Start a new journey only from the main menu.
- New journey resets journey totals and roster/boons while preserving permanent progress. Main menu can reopen the last results until a new journey begins; this is not a multi-journey history.
- Development saves are disposable; obsolete formats are rejected rather than migrated. Journey totals are recorded from current-format journeys, never inferred from lifetime XP or currency.
- Material types remain undefined and are not shown. The shared Victory shell shows compact automatic earnings and one encounter-specific choice: recruitment or boons. It has one Skip action, no Continue action. Full-roster replacement changes the contents of that same screen and may be canceled before committing.

See [UI design system](UI.md) for composition and interaction rules.

## Turn and combat foundation

Each turn restores four shared Mana and draws four cards, with a seven-card hand and FIFO overflow retained across turns. Block halves rather than clearing. Creatures share Alchemy's core packet, status and crowd-control rules through the [keyword contract](KEYWORDS.md), with no elemental reactions. Their individual effects persist while in reserve and cannot be refreshed by free swaps. Enemy actions use a non-repeating species repertoire without showing the next ability. Draw and discard piles are inspectable without revealing draw order or changing gameplay.

## Combat assistance

Auto-end turn is enabled by default and advances only when Mana reaches zero. Its Settings switch persists separately from progression; disabling it allows free swaps before manually ending the turn. Victory and defeat settle immediately in either mode.

Auto-play is explicitly enabled for one battle. It uses visible information to choose legal recovery swaps, healing, finishing attacks, other attacks and useful defenses, then ends turns when no useful play remains. Actions occur no faster than every 700 ms. Menus, inspection, focus loss and hidden pages pause it; manual play stops it. Rewards, encounters, recruitment and talents always remain player choices. It stops on completion, home navigation, save failure and shutdown.

Leaving newly completed results opens each newly unlocked creature's portrait and inspectable kit before Main menu. The reveal grants no progress and does not repeat when reopening results or loading an existing completed journey. Results otherwise retain the earnings-only design.

Development builds add Skip combat to the battle pause menu. It settles a normal victory with normal rewards and only XP already earned by actual plays; roster Health is preserved. It is unavailable in production and rejects repeated settlement.

## Optional support visits

Merchant appears beside the combat encounter after the first ordinary victory in each biome, only when at least one stocked item is affordable. It does not replace a battle. Inspecting and canceling is read-only; Enter commits the saved visit and rechecks affordability. Leave consumes it, even without buying, and beginning the next battle forfeits the opportunity. Returning preserves the exact enemy pack. There are no restocks or repeated Merchant visits in a biome.

The Merchant offers up to two distinct unowned Boons for 20 Gold each and allows one purchase. Gold is the existing permanent currency and carries between journeys. Bought Boons last only for that journey; they do not become permanent unlocks. Omit a Merchant with no eligible stock or insufficient Gold. Saved stock and prices cannot reroll on reload. Campfire visits preserve any Merchant offer and its purchase receipt. No visit grants keyword XP or recruitment, and all eight battles remain. Sheltered Springs are removed.
