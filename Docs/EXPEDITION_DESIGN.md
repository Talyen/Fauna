# Expedition progression — design decisions

These are the agreed directions from the design review. They supersede the prototype's choice between recruiting an immediate replacement and adding +2 to one card. The new progression rules are **not implemented**. Layout samples remain separate from gameplay.

## Roster and battles

- An expedition roster holds six distinct species: three active and three reserves. Duplicate species are excluded.
- Only the active three contribute their action cards to the shared deck.
- Benching a creature preserves its progress while removing its cards from the active deck.
- Team selection is the first step of beginning each battle. It is a separate destination/phase, not a post-battle reward step.
- Reveal the enemy lineup before team selection. Enemy intents remain hidden.
- Choose the active three, then begin combat. Team swaps happen outside combat.

## Training

- Training replaces the prototype's flat individual-card upgrades as the main expedition growth system.
- All recruited creatures receive victory training, including reserves.
- Training improves a creature's overall kit, including its contributed cards.
- Milestones offer fresh specialization upgrades. Creatures build combinations over successive milestones rather than committing to one fixed path.
- New recruits match the team's current training level so they can be used immediately.
- XP thresholds, ordinary level gains, milestone frequency, upgrade option count, and exact specialization effects remain open.
- Timing of milestone selections is awaiting a decision: resolve all on the reward screen, or require them before the creature next fights.

## Recruitment

- Recruit from defeated enemy species after a victory.
- Recruiting adds a creature to the expedition roster rather than forcing an immediate active-team replacement.
- The roster has one creature per species. Already-owned species do not create duplicate recruits.
- Recruitment remains a direct commitment on the final choice, without a separate confirmation.
- Number of recruits per victory and full-roster release/replacement behavior have not been finalized.

## Currency and items

- All currency is permanent and carries between expeditions.
- Currency funds meta progression. Specific purchases are **TBD**.
- Spending permanent currency during an expedition is a possible future feature; spending locations and an in-run shop flow have not been selected.
- Initial battle item rewards focus on run-wide relics: passive effects for the whole expedition.
- When a battle awards a relic, offer a choice of three.
- Currency names/types, payout amounts, relic drop frequency, exact relic effects, and relic ownership/unlocks between runs remain open.

## Screen flow

Ordinary victory → XP and other battle rewards → recruitment → next battle's team selection → combat.

- XP, currency and relic rewards share one screen.
- Recruitment has its own screen.
- Team selection belongs to the next battle, separate from both reward screens.
- No layout for these redesigned screens has been approved yet.
- Do not turn these design decisions into gameplay changes as part of the visual sample work.

See [UI design system](UI.md) for the approved battlefield composition and interaction rules.
