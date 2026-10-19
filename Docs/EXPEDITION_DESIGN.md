# Expedition progression — design decisions

These are the agreed directions from the design review. They supersede the prototype's choice between recruiting an immediate replacement and adding +2 to one card. The new progression rules are **not implemented**. Layout samples remain separate from gameplay.

## Roster and battles

- An expedition roster holds six distinct species: three active and three reserves. Duplicate species are excluded.
- Only the active three contribute their action cards to the shared deck.
- Benching a creature removes its cards from the active deck.
- Team selection is the first step of beginning each battle. It is a separate destination/phase, not a post-battle reward step.
- Reveal the enemy lineup before team selection. Enemy intents remain hidden.
- Choose the active three, then begin combat. Team swaps happen outside combat.
- Pre-battle selection shows separate active and reserve rows beneath the enemies. Select either creature first, then a creature in the other roster row to swap them.
- Reserve cards are smaller than enemy and active cards, emphasizing the active team while preserving artwork ratios.
- A Deck button opens an inspection dialog for the active team's nine action cards.

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
- Start with Alchemy's point pacing: the first point costs 20 keyword XP, then another 40, then 60, increasing by 20 each time. Total XP for point n is 10 × n × (n + 1). This is initial tuning for playtesting.
- Keyword list, talents per row, and exact talent effects remain open.
- XP settlement when abandoning an unfinished battle and the treatment of automatic/repeated card plays remain open.

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
- Currency names/types, payout amounts, relic drop frequency, exact relic effects, and relic ownership/unlocks between runs remain open.

## Screen flow

Ordinary victory → XP and materials/currency → recruitment → relic choice (if awarded) → next battle's team selection → combat.

- XP and materials/currency share one screen. Specific material types and uses remain undefined.
- Recruitment and relic choice each have their own screen; relic choice appears only when a relic is awarded.
- Relic effects remain in hover/focus tooltips.
- Keep keyword XP progress numbers visible beneath the bars on the XP reward screen.
- Team selection belongs to the next battle, separate from the reward screens.
- No layout for these redesigned screens has been approved yet.
- Do not turn these design decisions into gameplay changes as part of the visual sample work.

See [UI design system](UI.md) for the approved battlefield composition and interaction rules.
