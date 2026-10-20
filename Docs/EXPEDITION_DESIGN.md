# Journey progression — design decisions

These are the agreed directions from the design review. They supersede the prototype's choice between recruiting an immediate replacement and adding +2 to one card. The approved direction is implemented in gameplay. Isolated design samples remain available for comparison.

## Roster and battles

- Begin with one chosen starter. A journey roster grows to five creatures: up to three deployed and two reserves. Multiple copies of a species are allowed.
- Starter selection uses a three-column artwork grid of unlocked species. Clicking opens inspection with a Choose action; choosing returns to the grid and marks the selected creature. Begin journey is a separate action, available after choosing one starter. Inspecting or canceling never changes the choice. Choosing another replaces it.
- The starter supplies the remembered starting lineup. Recruits fill its second and third slots before joining reserves. The destination screen offers location artwork; inspection reveals the exact enemy group and Begin battle. Deck remains available without requiring team selection.
- Lineup is an optional menu dialog between battles, including ordinary reward screens. Changes save immediately. Combat swaps do not overwrite this starting lineup.
- Only deployed living creatures act and provide passive traits. Enemy intents remain hidden.
- During your turn, Swap opens a centered dialog with three deployed creatures and two reserves at the shared artwork size. Reserves are hidden on the battlefield.
- Select either creature first, then one from the opposite group to commit immediately. Swaps are free and unlimited; no Mana, draw, shuffle, turn advancement, or confirmation.
- A swap replaces the outgoing owner's three cards in their existing hand, draw, and discard positions. Spent cards stay spent. Legacy upgrades do not transfer to incoming creatures.
- Creature identity, health, Block, and first-attack state stay with the creature. Normal turn expiration applies in reserve; swapping never heals, cleanses, or repeats opening bonuses.
- Living reserves can replace knocked-out deployed creatures. Fallen creatures remain unavailable for the battle.
- If the deployed row falls, remaining enemy attacks stop and the next player turn begins with restored Mana. Healthy reserves can still enter through Swap. Defeat requires the whole roster to fall.
- Knocked-out card slots remain inert in saved battle zones and are skipped by ordinary draws. When the entire deployed row falls, the next hand reserves slots for incoming creatures so recovery does not require a free extra draw. These slots never render as playable cards for knocked-out owners.
- Victory restores the full roster. The next battle deploys the saved starting lineup.
- Recruitment at five requires choosing one creature to release, or skipping. Replacing a starting creature updates that individual’s lineup entry.

## Biomes and destinations

- New journeys travel through Fernwood, then Moonwater Marsh. Each biome has three ordinary encounters followed by its boss; only the final boss completes the journey and unlocks Moonhart.
- After each ordinary victory and its rewards, choose from three fresh locations in the current biome. The immediately visited location is excluded from the next offer. Boss steps offer one location. There is no branching map or Elite category.
- Each location uses a 4:3 illustration with its name and **Combat** or **Boss** below the artwork. Keep Combat visible in preparation for future non-combat destinations; those destinations are not implemented yet. A quiet heading shows the biome and current encounter within it.
- Opening a location is inspection, not commitment. Show its exact enemy group; inspect each creature's battle health and collectible kit in the same dialog. Back/Escape returns action → creature → location → destination screen. Begin battle commits the inspected location directly.
- Seeded gameplay chooses location offers and packs once when entering the choice screen. Save those offers and the chosen location. Inspection, cancellation, menus, and reload never reroll enemies or consume randomness.
- Location pools contain themed packs; identities are stable while inhabitants vary between runs. Initial enemy stats grow with chapter progress, with easier first encounters for a single starter. These values are playtest tuning, not final balance.

## Keyword XP and talents

- Creature XP, training levels, and milestone upgrades are retired design directions.
- Permanent keyword XP and talents replace creature training, taking Alchemy's keyword progression as a reference.
- Keyword progression is shared across the collection. Talents benefit any creature using the relevant keyword, rather than belonging to individual species.
- Each accepted card play earns 1 XP for each eligible keyword on that card, regardless of effect magnitude. A Fire + Block card earns 1 Fire XP and 1 Block XP.
- Earned keyword XP becomes permanent after each battle, including defeat.
- Talents are accessible through the main menu at any time. Purchases take effect immediately, including during an journey.
- Do not interrupt journeys or prompt players to spend talent points.
- Talents mix straightforward stat bonuses with new interactions and combo effects. Specific effects are not yet selected.
- Every talent can eventually be unlocked; there is no limited active-talent loadout.
- Complete every talent in a row to open the next row; choose purchase order within the current row.
- The Talents screen uses keyword tabs across the top, with the selected keyword's talent rows below.
- Each talent shows an icon and name; its effect is available in the hover/focus tooltip.
- Clicking an available talent purchases it immediately, without a detail-dialog purchase step or confirmation.
- Reset operates on the entire keyword category, refunding all spent points in that category while retaining its XP. Reset is available at any time, including during an journey; talent effects update immediately. Individual-talent refunds are not the chosen interaction.
- Start with Alchemy's point pacing: the first point costs 20 keyword XP, then another 40, then 60, increasing by 20 each time. Total XP for point n is 10 × n × (n + 1). This is initial tuning for playtesting.
- The starter catalog uses the seven damage types plus Block, Healing, and Mark. Each category has three rows of two talents: Potency, Mastery, Shelter, Guarded Focus, Renewal, and Readiness. Effects and IDs live in `src/game/progression.ts` and remain tunable.
- Abandonment banks the XP earned by accepted plays, with no victory currency or relics. There are currently no automatic or repeated card plays; each accepted play awards keyword XP once.

## Recruitment

- Recruit from defeated enemy species after an ordinary combat victory.
- Recruiting adds a creature to the journey roster rather than forcing an immediate active-team replacement.
- Each ordinary combat contains three enemies. Choose a Recruit shows those exact three entries in battle order, including repeated species and species already in the roster. Recruiting creates a new individual with independent identity and battle state.
- Recruitment remains a direct commitment on the final choice, without a separate confirmation.
- Recruit one defeated creature or skip recruitment.
- When the roster is full, choose the incoming species, then choose an existing creature to release. The final replacement choice commits immediately; canceling before that choice preserves the roster.

## Currency and items

- All currency is permanent and carries between journeys.
- Currency funds meta progression. Specific purchases are **TBD**.
- Spending permanent currency during an journey is a possible future feature; spending locations and an in-run shop flow have not been selected.
- Initial battle item rewards focus on run-wide relics: passive effects for the whole journey.
- When a battle awards a relic, offer a choice of three.
- Choose one relic or skip the reward. Relics use 3:4 portrait artwork wherever displayed, matching hand cards. Use the shared blank placeholder until dedicated artwork is authored; names stay below the art and effects in hover/focus tooltips.
- Starter tuning: Currency pays 20 per ordinary victory and 40 for each biome boss. Only intermediate biome bosses offer three distinct unowned relics when three remain. Ordinary combat offers recruitment, never relics; intermediate bosses offer relics, never recruitment. Five starter relics are authored in `src/game/progression.ts`; their ownership lasts only for the journey. Currency spending and material types remain undefined and are not implemented.

## Screen flow and Journey results

Journey is the player-facing name. Internal command IDs, route fields, filenames, and storage paths retain their existing names.

Ordinary victory → shared Reward screen with recruitment (if available) → fresh destinations. Intermediate boss victory → the same Reward screen with relic choices (if available) → the next biome. Compact last-battle currency and keyword XP earnings appear beside choices and remain visible on destinations until the next battle. No separate acknowledgement screen interrupts new journeys. If neither decision is available, proceed directly to destinations.

Final victory or defeat → Journey results. Ending a started journey voluntarily also opens results, labeled Returned home. Ending an unfinished starter choice simply returns to the main menu.

- Results show only the outcome, keyword XP and permanent currencies/resources/items earned. Do not show the team, creature unlocks, journey-only relics, location, or journey statistics. Currency is the only authored permanent resource currently; do not invent item or material rewards.
- Keyword totals include all settled battles and XP banked when returning home. Follow Alchemy’s results presentation: keyword name, level (earned points + 1), and progress bar only. Hide numeric XP gains/fractions and points-earned lines here; the Talents screen owns point availability. This is a presentation change; Fauna retains its current 20/60/120 total XP thresholds. Talents remain menu-driven; never prompt purchases here.
- Banking and totals update atomically with accepted gameplay commands. Browsing results never grants rewards or saves. Report actual retained earnings at progression caps.
- Results offer a single centered Main menu action. Start a new journey only from the main menu.
- New journey resets journey totals and roster/relics while preserving permanent progress. Main menu can reopen the last results until a new journey begins; this is not a multi-journey history.
- Development saves are disposable; obsolete formats are rejected rather than migrated. Journey totals are recorded from current-format journeys, never inferred from lifetime XP or currency.
- Material types remain undefined and are not shown. The shared Reward shell shows compact automatic earnings and one destination-specific choice: recruitment or relics. It has one Skip action, no Continue action. Full-roster replacement changes the contents of that same screen and may be canceled before committing.

See [UI design system](UI.md) for composition and interaction rules.
