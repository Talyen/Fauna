# Nine artwork-led Boons

The owner approved Aether Gramophone, Herbarium Press, the revised Honey Press,
Rook of Mercy, Tidecrest Hairpin, Stardust Whetstone, Ashfall Pendant, Wishing
Building Block and Sovereign Toast Rack on October 26, 2026. The former Nebula
Weld Clamp proposal became the base Armor rule in an earlier change. Current
copy, numbers and interactions live in the [Boon rules](../../src/game/rules/boons.ts)
and [execution contracts](../content/boons.md#nine-artwork-led-boons).

The nine selected Google Drive PNG originals remain unchanged in `public/art/boons/`;
the manifest records each original name and Drive link. The existing uncropped,
lossless card recipe prepared nine 720 × 960 portraits. Preparation verified 311
selections, reused 302 and encoded nine. Active media measures 221.31 MiB across
306 unique objects; the total allowance is 223 MiB and the existing 3 MiB per-image
ceiling and quality recipe remain unchanged.

The exact `npm test -- tests/unit/game/nine-new-boons.test.ts` regression passed
19 cases. It covers catalog/save/artwork registration, repeated-attack Dodge and
reflection, Cleanse protection, linked Purge healing, position and backup swaps,
Armor-to-Block sharing, Water Thorns retention and Purge, Blocked Physical hits,
Nullify, Burn decay and repeated Food. Full CI, broad balance checks, native desktop,
Windows packaging, physical controllers, Steam client and Steam Deck remain unrun.

## Rendered review

The task-owned Vite review at `reports/nine-boons-rendered/` contains six whole-screen
frames and nine tooltip frames, with the driver and results at
`reports/nine-boons-review.mjs` and `reports/nine-boons-rendered/evidence.json`.
The base Boon reward screen was inspected before edits in
`reports/review/nine-boons-before-d7424b85-6bb9-479f-9109-263e0b632eba/`.
Both used the same reward fixture, reduced motion, 1280 × 720 at 125% text and
1920 × 1080 at default text. The after fixture substitutes the nine new Boons in
three groups, so reward choices differ while the surrounding screen and conditions
match. The images and full frames were inspected for silhouette, framing, contrast,
wrapping and fit. Tooltip inspection covered all nine effects; keyboard selection
and committed save/reload were exercised for Aether Gramophone. Layout checks and
browser error collection reported no violations. Browser input simulation does not
establish physical controller or native-platform behavior. The owner selected the
artwork and mechanics; this inspection is not separate approval of the whole screen.
