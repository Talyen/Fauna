# Expedition progression — design decisions

These are the agreed directions from the design review. They supersede the prototype's choice between recruiting an immediate replacement and adding +2 to one card. The approved direction is implemented in gameplay. Isolated design samples remain available for comparison.

## Roster and battles

- An expedition roster holds five distinct species: three deployed and two reserves. Duplicate species are excluded.
- The initial draft supplies the remembered starting lineup. The encounter preview shows enemies, Deck, and Begin battle without requiring team selection.
- Lineup is an optional menu dialog between battles, including ordinary reward screens. Changes save immediately. Combat swaps do not overwrite this starting lineup.
- Only deployed living creatures act and provide passive traits. Enemy intents remain hidden.
- During your turn, Swap opens a centered dialog with three deployed creatures and two smaller reserves. Reserves are hidden on the battlefield.
- Select either creature first, then one from the opposite group to commit immediately. Swaps are free and unlimited; no Mana, draw, shuffle, turn advancement, or confirmation.
- A swap replaces the outgoing owner's three cards in their existing hand, draw, and discard positions. Spent cards stay spent. Legacy upgrades do not transfer to incoming creatures.
- Creature identity, health, Block, and first-attack state stay with the creature. Normal turn expiration applies in reserve; swapping never heals, cleanses, or repeats opening bonuses.
- Living reserves can replace knocked-out deployed creatures. Fallen creatures remain unavailable for the battle.
- If the deployed row falls, remaining enemy attacks stop and the next player turn begins with restored Mana. Healthy reserves can still enter through Swap. Defeat requires the whole roster to fall.
- Knocked-out card slots remain inert in saved battle zones and are skipped by ordinary draws. When the entire deployed row falls, the next hand reserves slots for incoming creatures so recovery does not require a free extra draw. These slots never render as playable cards for knocked-out owners.
- Victory restores the full roster. The next battle deploys the saved starting lineup.
- Recruitment at five requires choosing one creature to release, or skipping. Replacing a starting species updates its lineup entry.

## Keyword XP and talents

- Creature XP, training levels, and milestone upgrades are retired design directions.
- Permanent keyword XP and talents replace creature training, taking Alchemy's keyword progression as a reference.
- Keyword progression is shared across the collection. Talents benefit any creature using the relevant keyword, rather than belonging to individual species.
- Each accepted card play earns 1 XP for each eligible keyword on that card, regardless of effect magnitude. A Fire + Block card earns 1 Fire XP and 1 Block XP.
- Earned keyword XP becomes permanent after each battle, including defeat.
- Talents are accessible through the main menu at any time. Purchases take effect immediately, including during an expedition.
- Do not interrupt expeditions or prompt players to spend talent points.
- Talents mix straightforward stat bonuses with new interactions and combo effects. Specific effects are not yet selected.
- Every talent can eventually be unlocked; there is no limited active-talent loadout.
- Complete every talent in a row to open the next row; choose purchase order within the current row.
- The Talents screen uses keyword tabs across the top, with the selected keyword's talent rows below.
- Each talent shows an icon and name; its effect is available in the hover/focus tooltip.
- Clicking an available talent purchases it immediately, without a detail-dialog purchase step or confirmation.
- Reset operates on the entire keyword category, refunding all spent points in that category while retaining its XP. Reset is available at any time, including during an expedition; talent effects update immediately. Individual-talent refunds are not the chosen interaction.
- Start with Alchemy's point pacing: the first point costs 20 keyword XP, then another 40, then 60, increasing by 20 each time. Total XP for point n is 10 × n × (n + 1). This is initial tuning for playtesting.
- The starter catalog uses the seven damage types plus Block, Healing, and Mark. Each category has three rows of two talents: Potency, Mastery, Shelter, Guarded Focus, Renewal, and Readiness. Effects and IDs live in `src/game/progression.ts` and remain tunable.
- Abandonment banks the XP earned by accepted plays, with no victory currency or relics. There are currently no automatic or repeated card plays; each accepted play awards keyword XP once.

## Recruitment

- Recruit from defeated enemy species after a victory.
- Recruiting adds a creature to the expedition roster rather than forcing an immediate active-team replacement.
- The roster has one creature per species. Already-owned species do not create duplicate recruits.
- Recruitment remains a direct commitment on the final choice, without a separate confirmation.
- Recruit one defeated species or skip recruitment.
- When the roster is full, choose the incoming species, then choose an existing creature to release. The final replacement choice commits immediately; canceling before that choice preserves the roster.

## Currency and items

- All currency is permanent and carries between expeditions.
- Currency funds meta progression. Specific purchases are **TBD**.
- Spending permanent currency during an expedition is a possible future feature; spending locations and an in-run shop flow have not been selected.
- Initial battle item rewards focus on run-wide relics: passive effects for the whole expedition.
- When a battle awards a relic, offer a choice of three.
- Choose one relic or skip the reward.
- Starter tuning: Currency pays 20 per ordinary victory and 40 for the boss. Each ordinary victory offers three distinct unowned relics when three remain. Five starter relics are authored in `src/game/progression.ts`; their ownership lasts only for the expedition. Currency spending and material types remain undefined and are not implemented.

## Screen flow

Ordinary victory → XP and materials/currency → recruitment → relic choice (if awarded) → next encounter preview → combat.

Final victory → XP and currency → expedition results. Recruitment and expedition-only relics are offered between battles.

- XP and materials/currency share one screen. Specific material types and uses remain undefined.
- Recruitment and relic choice each have their own screen; relic choice appears only when a relic is awarded.
- Relic effects remain in hover/focus tooltips.
- Keep keyword XP progress numbers visible beneath the bars on the XP reward screen.
- Optional Lineup management is available through the menu between battles and is never a reward step.
- Gameplay now uses the reviewed minimal layouts for the separate reward screens, smaller reserves, and full-screen talent/collection pages.

See [UI design system](UI.md) for the approved battlefield composition and interaction rules.
