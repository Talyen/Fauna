# Aerostat implementation evidence

Selected on October 25, 2026. [Kit and provenance](../content/creatures/aerostat.md) · [Focused regression](../../tests/unit/game/creatures/aerostat.test.ts)

## Implementation scope

Well Provisioned shuffles 1/2/3/4/5/6 shared Food into the starting deck for every combat. Voyager’s Rest gives 6 self Block; True Bearing draws 2 cards and Cleanses allied Blind; Parcel Drop adds 2 Food to hand. Starting supplies reuse the existing Food/Consume lifecycle and are replenished at each battle opening. Extra generated supplies remain battle-only. Original artwork is preserved and prepared through the standard pipeline.

## Observed checks

- Exact focused command: `npm test -- tests/unit/game/creatures/aerostat.test.ts`; 15 tests passed in 1.86 seconds with one worker
- Covered all six starting counts, duplicates, inactive providers, deterministic openings, opening-hand eligibility, no replay on turns/swaps/resume, abilities, preview parity, upgrades, capacity/overflow, rejection, neutral ownership, repeat-before-Consume, absence after save/resume, and replenishment next battle
- `npm run assets:prepare`: 216 selections verified; 212 cached, four new images prepared
- Baseline rendered inspection: primary checkout `reports/review/aerostat-before-eed0cda6-7346-4e99-8cf4-a2b2d848a799/`; Dulcera’s existing Collection inspection at 1280×720 with 125% text and 1920×1080 with default text
- Task rendered review and the final protected integration gate are recorded below when completed

## Verification boundaries

The focused regression is local gameplay evidence. Rendered browser evidence is separate from native desktop, Windows packaging, physical controller, Steam client and Steam Deck checks. Full static checks, compilation, broad tests and measured balance remain CI-owned and have not run for this task. No hosted CI result is claimed and no push is authorized.
