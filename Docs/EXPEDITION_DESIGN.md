# Journey progression — design decisions

These are the agreed directions from the design review. They supersede the prototype's choice between recruiting an immediate replacement and adding +2 to one card. The approved direction is implemented in gameplay. Isolated design samples remain available for comparison.

## Roster and battles

- Your first journey begins with one creature, chosen from three seeded offers from the configured `FIRST_RUN_STARTERS` pool in `src/game/content.ts`. Committing Begin journey adds that creature to Collection. Inspecting and canceling do not collect it.
- Later journeys draft three starters from collected species: choose one of three offers, three times. Each choice commits immediately and prepares the next saved offer; Begin journey becomes available after all three choices. Species may repeat across rounds. Pools smaller than three repeat species within the offer, so an early loss never prevents a new journey. With three or more collected species, each offer contains three distinct species.
- Clicking starter artwork opens inspection with a Choose action. Browsing, canceling and reloading preserve the current offers and earlier picks. After drafting, the chosen team remains inspectable before Begin journey.
- A journey roster grows to five creatures: up to three deployed and two backup. Multiple copies of a species are allowed. The drafted team supplies the remembered starting lineup. On the first journey, recruits fill its second and third slots before joining backup. The encounter screen offers one Combat or Boss placeholder ArtCard that starts battle directly. Deck remains available without requiring team selection.
- Lineup is an optional menu dialog between battles, including ordinary reward screens. Changes save immediately. Combat swaps do not overwrite this starting lineup.
- Only deployed living creatures act and provide passive traits. Enemy intents remain hidden.
- During your turn, Swap opens a centered dialog with three deployed creatures and two backup at the shared artwork size. Backup are hidden on the battlefield.
- Select either creature first, then one from the opposite group to commit immediately. Swaps are free and unlimited; no Mana, draw, shuffle, turn advancement, or confirmation.
- A free manual swap replaces the outgoing owner's three cards in their existing hand, overflow, draw, and discard positions. Spent cards stay spent. Card upgrades do not transfer to incoming creatures.
- Swap cards choose a random living backup, remove the departing kit from all zones, and shuffle the incoming kit into the draw pile before any draw effect. Without living backup they swap positions with a random living ally; alone the swap part does nothing. See [Captoad](CONTENT.md#captoad).
- Creature identity, health, Block, and first-attack state stay with the creature. Normal turn expiration applies in backup; swapping never heals, cleanses, or repeats opening bonuses.
- Living backup can replace knocked-out deployed creatures. Fallen creatures remain unavailable for the battle.
- If the deployed row falls, remaining enemy attacks stop and the next player turn begins with restored Mana. Healthy backup can still enter through Swap. Defeat requires the whole roster to fall.
- Knocked-out card slots remain inert in saved battle zones and are skipped by ordinary draws. When the entire deployed row falls, the next hand reserves slots for incoming creatures so recovery does not require a free extra draw. These slots never render as playable cards for knocked-out owners.
- Victory preserves roster Health and knockouts. The next battle deploys the saved starting lineup; combat effects reset.
- Recruitment at five requires choosing one creature to release. Replacing a starting creature updates that individual’s lineup entry.

## Encounters

- A journey has eight encounters: Combat, Combat, Combat, Boss, Combat, Combat, Combat, Boss. Only the final boss completes the journey.
- Each step has one saved encounter: Combat for the three ordinary battles, then Boss. Ordinary packs come from the shared combat pool; each boss has an authored pack. Packs remain unchanged through support visits and reload. Combat uses blank landscape artwork; Boss shows its authored name and species artwork, with names beneath. Campfire appears alongside the encounter whenever any roster creature, including a backup or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns without advancing the encounter or changing RNG. The room type most recently visited is omitted from the returning destination options. Resting or leaving Campfire therefore suppresses Campfire until another room has been visited. Combat or Boss remains available as the required progression fallback.
- Combat and Boss entrances use 4:3 ArtCards, with Combat or the boss name below the artwork. Campfire uses Rest beneath its location art; entering it commits a saved visit and exposes Rest as its only option. A quiet heading shows the encounter number out of eight.
- Activating Combat or Boss immediately commits the saved encounter and starts battle. There is no enemy preview, inspection dialog or separate Begin battle action. Creature and action hover/focus details remain available during battle; pinned kit inspection belongs outside battle and in Collection.
- Seeded gameplay chooses and saves one enemy pack when entering the encounter screen. Menus, support visits and reload never reroll enemies or consume randomness.
- The shared enemy pool varies between runs. Every enemy, including named bosses and escorts, starts from its species’ authored base Health before encounter scaling; recruits use the unscaled species Health. Health and authored ability damage, healing and Block gain an additive 10% of their base per room after the first: 100% in room 1 through 170% in room 8, rounded to the nearest whole number. Support visits do not advance this scaling. Enemies use shared authored ability values, including area attacks, modified by explicit room power rather than replacement encounter damage. Chances, effect counts and resources do not scale. The first battle has one enemy and the second has two. These values are playtest tuning, not final balance.

## Keyword XP and talents

- Creature XP, training levels, and milestone upgrades are retired design directions.
- Permanent keyword XP and talents replace creature training, taking Alchemy's keyword progression as a reference.
- Keyword progression is shared across the collection. Talents benefit any creature using the relevant keyword, rather than belonging to individual species.
- Each accepted card play earns 1 XP for each eligible keyword on that card, regardless of effect magnitude. A Burn + Block card earns 1 Burn XP and 1 Block XP.
- Earned keyword XP becomes permanent after each battle, including defeat.
- Talents are accessible through the main menu at any time. Purchases take effect immediately, including during a journey.
- Do not interrupt journeys or prompt players to spend talent points.
- Talents mix straightforward stat bonuses with new interactions and combo effects. The applicable Alchemy effects are implemented in the authored catalog.
- Every talent can eventually be unlocked; there is no limited active-talent loadout.
- Each category starts with the existing two talents. Later talents form rows of two, with a possible single-talent final row; complete all earlier rows to open the next.
- The Talents screen opens on a keyword artwork overview, following Alchemy. Selecting a keyword opens its dedicated tree; Back returns to the overview.
- Each talent shows its icon, name, and full effect directly on the talent. Effects use concise rules with ownership implied where clear. All talents have distinct effects; do not repeat a shared talent set across keywords.
- Clicking an available talent purchases it immediately, without a detail-dialog purchase step or confirmation.
- Reset operates on the entire keyword category, refunding all spent points in that category while retaining its XP. Reset is available at any time, including during a journey; talent effects update immediately. Individual-talent refunds are not the chosen interaction.
- Use Alchemy’s current point pacing: cumulative thresholds are 10, 40, 100, 180, and 280 keyword XP. Total XP for point n is 10 × n × (n + 1) − 10 × min(n, 2). This is initial tuning for playtesting.
- Fifteen consolidated categories offer 135 distinct talents, adapted from Alchemy; effects requiring excluded mechanics are omitted. Burn, Freeze, Stun and Health use their matching progression; Thorns belongs to Nature, Cleanse to Health, and Purge to Light. Forge is removed. The authored catalog and effects are owned by `src/game/progression.ts` and `src/game/combat.ts`.
- Abandonment banks the XP earned by accepted plays, with no victory currency or boons. Auto-play dispatches ordinary accepted plays; each awards keyword XP once. Talent repeats resolve at most once and award no extra accepted-play XP.

## Recruitment

- Optional Recruit destinations offer one uniformly selected creature from the entire species catalog, including uncollected and already-owned species. They roll only while the roster has fewer than five creatures and stop appearing at five.
- The destination shows creature artwork, Recruit and the species name. Hover/focus shows its current passive and all three ability rules. Activating recruits directly at full Health, filling the starting lineup up to three and then reserves, without a confirmation or release step. Recruitment counts toward permanent collection and passive ranks.
- Claiming consumes the saved offer atomically without advancing the encounter, spending Gold or changing RNG. Starting the battle skips any unclaimed offer. Optional recruitment does not change ordinary victory recruitment.

- Recruit from defeated enemy species after an ordinary combat victory.
- Recruiting adds a creature to the journey roster rather than forcing an immediate active-team replacement.
- The first battle contains one enemy, the second contains two, and every later battle, including bosses, contains three. Choose a Recruit shows the exact defeated enemy entries in battle order, including repeated species and species already in the roster. Recruiting creates a new individual with independent identity and battle state.
- Recruitment remains a direct commitment on the final choice, without a separate confirmation.
- Recruit one defeated creature whenever recruits are offered; recruitment cannot be skipped, including at a full roster. Collected species persist after release, defeat and return home. Encountering a species or unlocking it through victory does not collect it.
- When the roster is full, choose the incoming species, then choose an existing creature to release. The final replacement choice commits immediately; canceling before that choice preserves the roster.

## Currency and items

- All Gold is permanent and carries between journeys.
- Gold buys journey Boons at Merchants; permanent upgrade purchases and other currencies are undefined.
- Recruit and Merchant destinations roll independently with equal 25% chances when preparing each encounter. Offers persist through menus, support visits and reload; no visit rerolls them. A Merchant can roll when an item is affordable. Buy one of up to two unowned journey Boons for 20 Gold (13 with Merchant’s Favor when stock is prepared), or Leave. Currency spending is atomic and reduces the wallet, while journey earnings remain gross retained income.
- Initial battle item rewards focus on run-wide boons: passive effects for the whole journey.
- When a battle awards a Boon, offer up to three distinct unowned choices.
- Choose one boon or skip the reward. Boons use 3:4 portrait artwork wherever displayed, matching hand cards. All 18 Boons use copied Alchemy artwork; names stay below the art and effects in hover/focus tooltips. Owned Boons are inspectable from the menu during a journey.
- Starter tuning: Currency pays 20 per ordinary victory and 40 for each boss. Intermediate bosses offer up to three distinct unowned Boons; smaller nonempty pools remain available. Ordinary combat offers recruitment, never boons; intermediate bosses offer boons, never recruitment. Eighteen Boons are authored in `src/game/progression.ts`; their ownership lasts only for the journey. Material types and permanent upgrade purchases remain undefined.

## Screen flow and Journey results

Journey is the player-facing name. Internal command IDs, route fields, filenames, and storage paths retain their existing names.

Ordinary victory → shared Victory screen with recruitment (if available) → the next encounter. Intermediate boss victory → the same Victory screen with boon choices (if available) → the next encounter. Compact last-battle currency and keyword XP earnings appear beside choices and remain visible on the encounter screen until the next battle. No separate acknowledgement screen interrupts new journeys. If neither decision is available, proceed directly to the next encounter.

Final victory or defeat → Journey results. Ending a started journey voluntarily also opens results, labeled Returned home. Ending an unfinished starter choice simply returns to the main menu.

- Results show only the outcome, keyword XP and permanent currencies/resources/items earned. Do not show the team, creature unlocks, journey-only boons, location, or journey statistics. Currency is the only authored permanent resource currently; do not invent item or material rewards.
- Keyword totals include all settled battles and XP banked when returning home. Follow Alchemy’s results presentation: keyword name, level (earned points + 1), and progress bar only. Hide numeric XP gains/fractions and points-earned lines here; the Talents screen owns point availability. Fauna uses the current 10/40/100 total XP thresholds. Talents remain menu-driven; never prompt purchases here.
- Banking and totals update atomically with accepted gameplay commands. Browsing results never grants rewards or saves. Report actual retained earnings at progression caps.
- Results offer a single centered Main menu action. Start a new journey only from the main menu.
- Play resets journey totals and roster/boons while preserving permanent progress. Results appear only when ending the journey; returning to the main menu or loading a completed journey does not reopen them.
- Development saves are disposable; obsolete formats are rejected rather than migrated. Journey totals are recorded from current-format journeys, never inferred from lifetime XP or currency.
- Material types remain undefined and are not shown. The shared Victory shell shows compact automatic earnings and one encounter-specific choice: recruitment or boons. Only Boon choices have a Skip action; recruitment is required. There is no Continue action. Full-roster replacement changes the contents of that same screen and may be canceled before committing.

See [UI design system](UI.md) for composition and interaction rules.

## Turn and combat foundation

Each turn normally restores four shared Mana and draws four cards, with explicit talent and Boon modifiers. The hand holds seven cards; FIFO overflow persists across turns. Block halves rather than clearing. Creatures share Alchemy's core packet, status and crowd-control rules through the [keyword contract](KEYWORDS.md), with no elemental reactions. Their individual effects persist while in backup and cannot be refreshed by free swaps. Enemy actions use a non-repeating species repertoire without showing the next ability. Draw and discard piles are inspectable without revealing draw order or changing gameplay.

## Combat assistance

Auto-end turn is enabled by default and advances only when Mana reaches zero. Its Settings switch persists separately from progression; disabling it allows free swaps before manually ending the turn. Victory and defeat settle immediately in either mode.

Auto-play is explicitly enabled for one battle. It uses visible information to choose legal recovery swaps, healing, finishing attacks, other attacks and useful defenses, then ends turns when no useful play remains. Actions occur no faster than every 700 ms. Menus, inspection, focus loss and hidden pages pause it; manual play stops it. Rewards, encounters, recruitment and talents always remain player choices. It stops on completion, home navigation and shutdown; save retries remain independent of combat assistance.

Leaving newly completed results opens each newly unlocked creature's portrait and inspectable kit before Main menu. The reveal grants no progress and does not repeat when loading an existing completed journey. Results otherwise retain the earnings-only design.

Development builds add a Skip combat icon beside the battle menu and Auto-play controls. It settles a normal victory with normal rewards and only XP already earned by actual plays; roster Health is preserved. It is unavailable in production and rejects repeated settlement.

## Optional support visits

Merchant rolls independently alongside Recruit at the shared 25% rate, only when at least one stocked item is affordable. It does not replace a battle. Activating the Merchant ArtCard commits the saved visit directly and rechecks affordability. Leave consumes it, even without buying, and beginning the next battle forfeits the opportunity. Returning preserves the exact enemy pack. Each offer allows one visit, without restocks.

The Merchant offers up to two distinct unowned Boons for 20 Gold each (13 with Merchant’s Favor when stock is prepared) and allows one purchase. Gold is the existing permanent currency and carries between journeys. Bought Boons last only for that journey; they do not become permanent unlocks. Omit a Merchant with no eligible stock or insufficient Gold. Saved stock and prices cannot reroll on reload. Campfire visits preserve any Merchant offer and its purchase receipt. Merchant and Campfire grant no keyword XP or recruitment; Recruit grants only its offered creature. All eight battles remain. Sheltered Springs are removed.
