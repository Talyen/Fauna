# Aerostat implementation evidence

Selected on October 25, 2026. [Kit and provenance](../content/creatures/aerostat.md) · [Focused regression](../../tests/unit/game/creatures/aerostat.test.ts)

## Implementation scope

Well Provisioned shuffles 1/2/3/4/5/6 shared Food into the starting deck for every combat. Voyager’s Rest gives 6 self Block; True Bearing draws 2 cards and Cleanses allied Blind; Parcel Drop adds 2 Food to hand. Starting supplies reuse the existing Food/Consume lifecycle and are replenished at each battle opening. Extra generated supplies remain battle-only. Original artwork is preserved and prepared through the standard pipeline.

## Observed checks

- Exact focused command: `npm test -- tests/unit/game/creatures/aerostat.test.ts`; 15 tests passed in 1.86 seconds with one worker
- Covered all six starting counts, duplicates, inactive providers, deterministic openings, opening-hand eligibility, no replay on turns/swaps/resume, abilities, preview parity, upgrades, capacity/overflow, rejection, neutral ownership, repeat-before-Consume, absence after save/resume, and replenishment next battle
- `npm run assets:prepare`: 216 selections verified; 212 cached, four new images prepared
- Baseline rendered inspection: primary checkout `reports/review/aerostat-before-eed0cda6-7346-4e99-8cf4-a2b2d848a799/`; Dulcera’s existing Collection inspection at 1280×720 with 125% text and 1920×1080 with default text
- Lightweight changed-file formatting, syntax/source contracts and documentation checks passed; the final protected integration gate remains required

## Rendered review

The task used quiet Vite/Chromium previews in fresh profiles with reduced motion. Complete captures were inspected at 1280×720 with 125% text and 1920×1080 with default text for Collection inspection and battle; five-star inspection was also inspected at the smaller condition:

- `reports/review/aerostat-collection-d1dd764b-1ab1-49c4-834c-ca72aa8d09c7/`
- `reports/review/aerostat-battle-cea029b0-4bed-4fc9-8b03-8a38ce3c2038/`
- `reports/review/aerostat-rank-five-599cb86e-d8d2-41ea-b119-52d7c342dee0/`

The selected images retain their native composition and a consistent blue/gold travel palette. Aerostat’s portrait, packs, compass, shelter and parcels remain recognizable at gameplay scale. The passive reads 1 Food at zero stars and 6 at five stars, with readable copy and no layout assertion failures. The owner selected the three ability illustrations; this review establishes rendered suitability rather than broader artistic approval.

`reports/aerostat-interactions/initial-evidence.json` records successful live plays of all three abilities, Food targeting/cancellation with focus return, consumed Food staying absent after reload/Continue, and nested Collection inspection with opener focus return. That initial harness then timed out because Playwright correctly refused to click an aria-disabled card. `reports/aerostat-interactions/unavailable.json` records the focused correction: keyboard activation of the unaffordable Parcel Drop left the committed revision unchanged. This was a harness correction, with no gameplay patch. Owned previews and browser contexts were closed.

Current-main reconciliation and its verification are recorded below after completion.

## Verification boundaries

The focused regression is local gameplay evidence. Rendered browser evidence is separate from native desktop, Windows packaging, physical controller, Steam client and Steam Deck checks. Full static checks, compilation, broad tests and measured balance remain CI-owned and have not run for this task. No hosted CI result is claimed and no push is authorized.
