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
with one worker under the 30-second limit after incorporating current main, using
Node 24.22.1 and npm 12.2.1. It covers all ten together, status protection and
reflection, actual restoration,
Dodge counters, control damage through Block, Bleed defeat and delayed Leech,
Freeze-reward ordering, Ravelland's Block-break Armor, preview isolation and
save/resume. The changed-file gate passes separately; it defers compilers and
broader suites to hosted CI.

The initial before capture could not reach the reward screen because committed
main's content validator referenced an undefined species lookup. The fix arrived
independently on main and is present in the combined checkout. An existing reward
screen was then captured as a layout reference; it is not a pre-edit acceptance.

The latest captures under `reports/ten-boons-latest-layout/` contain four
reward configurations at 1280×720 with 125% text and 1920×1080 at default text,
with reduced motion. All eight frames completed without layout failures or page
errors. Their render-input identity is
`68d1bfbc375ba5827ea7cc00318d9d9f06b9b39dd094c87bd35df9abba093d47`.
Bellows Heart was selected by keyboard and retained after reload on this version.
The ten source portraits and whole-screen renderings were inspected at player
scale. An earlier combined interaction pass under
`reports/ten-boons-reconciled-interaction/` inspected every tooltip, selected each
Boon by keyboard and verified ownership after reload, with no page errors. Its
render-input identity was `60d67892da92b6e569aa8250c16c7401b885ab0e32b535227831e31ba1fa7a25`;
the subsequently incorporated main changes concerned gameplay allocations, not
reward UI or artwork. An earlier pass stopped after two items at its bounded
inspection lease; its incomplete evidence remains separate.

This is task-owned Vite browser and keyboard evidence. Compilation, broad unit and
browser suites, hosted CI, balance sweeps, native desktop, Windows packaging,
physical controllers, Steam client and Steam Deck remain unverified. Source and
agent-rendered review do not establish separate user artistic acceptance.
