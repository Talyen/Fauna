# Ten artwork-led Boons

Bellows Heart, Leafwing Shuttlecock, Soot Brush, Echo Ocarina, Glassleaf Shield,
Harvest Shears, Frostglass Die, Reef Diadem, Chromatic Viol and Mirror Locket use
their selected Drive portraits and the rules in the [Boon catalog](../content/boons.md#execution-contracts).
Original PNGs remain unchanged in `public/art/boons/`; the manifest records the
source links and the shared lossless card recipe publishes their prepared images.

The combined current-main selection contains 330 unique prepared objects totaling
238.92 MiB. Ten portraits add 6.77 MiB over their earlier base; Ravelland's four
independent images arrived on main during the task. The active-media allowance
therefore rises from 231 to 242 MiB, retaining the existing 3 MiB per-image limit.
These are source-inventory figures, not a build or packaged-size measurement.

## Focused verification

The exact `tests/unit/game/chromatic-ten-boons.test.ts` regression passed 19 tests
with one worker under the 30-second limit after incorporating current main. It
covers all ten together, status protection and reflection, actual restoration,
Dodge counters, control damage through Block, Bleed defeat and delayed Leech,
Freeze-reward ordering, Ravelland's Block-break Armor, preview isolation and
save/resume. The changed-file gate passes separately; it defers compilers and
broader suites to hosted CI.

The initial before capture could not reach the reward screen because committed
main's content validator referenced an undefined species lookup. The fix arrived
independently on main and is present in the combined checkout. An existing reward
screen was then captured as a layout reference; it is not a pre-edit acceptance.

The combined captures under `reports/review/combined-ten-boons-*` contain four
reward configurations at 1280×720 with 125% text and 1920×1080 at default text,
with reduced motion. All eight frames completed without layout failures or page
errors. Their shared render-input identity is
`53382d1dcb73c0b7ea0bd43e99efefa0437ab32c491dd74e7aa98908ee2e6459`.
The ten source portraits and whole-screen renderings were inspected together at
player scale. The combined interaction pass under
`reports/ten-boons-interactions-final/` inspected every tooltip, selected each
Boon by keyboard and verified ownership after reload, with no page errors. An
earlier combined pass stopped after two items at its bounded inspection lease;
its incomplete evidence remains separate.

This is task-owned Vite browser and keyboard evidence. Compilation, broad unit and
browser suites, hosted CI, balance sweeps, native desktop, Windows packaging,
physical controllers, Steam client and Steam Deck remain unverified. Source and
agent-rendered review do not establish separate user artistic acceptance.
