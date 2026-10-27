# Journey artifact Boons

The ten selected Drive portraits and their implemented effects are recorded in the [Boon contracts](../content/boons.md#journey-artifact-boons). Cornucopia adds its Mana Berries to the saved journey deck when acquired; playing it consumes the battle copy, and settlement restores the journey card. The current development save format is 67; obsolete development saves are rejected.

The selected originals and prepared assets are retained with their Drive provenance. The prepared inventory contains 357 unique objects totaling 257.91 MiB. The media budget is 261 MiB; this is an inventory measurement, not a built package measurement.

The exact `tests/unit/game/journey-artifact-boons.test.ts` suite passed 12 focused tests with one worker after incorporating current main. It covers all ten, attack reflection, status and retaliation effects, card descriptions, selection, save/resume, consumption and battle settlement. The lightweight changed-file gate passed; compilation and broader tests remain CI-owned.

The reward screen was inspected against the earlier existing screen at `reports/review/boon-baseline-73dee1e0-10b7-4d95-b1f7-32cac7430466/` in the primary checkout. Final combined captures for all ten portraits are under `reports/review/final-journey-boons-{1,2,3,4}-*/` in the task checkout. Each group has whole-screen frames at 1280×720 with 125% text and 1920×1080 at default text, with reduced motion; all eight completed with no recorded layout failures or page errors. Their render-input identity is `40975cede0e3a2febdfd4927cf03b189f351305980f350a8899bdce8df8eaf13`. The images and their composition were inspected at player scale.

The focused browser interaction under `reports/journey-boons-interactions/` inspected each effect tooltip, selected each Boon using the keyboard, and verified the saved ownership after reload. Cornucopia's Mana Berries was also found in the between-battle Deck after reload; its actual artwork and revised effect tooltip were inspected. The saved `first-results.json` and `last-results.json` together record the ten choices. An initial focus check and an early unsettled Deck screenshot were diagnostic attempts, not visual acceptance.

These are task-owned Vite browser and simulated keyboard checks. Full compilation, broad tests, hosted CI, balance measurements, native desktop, Windows packaging, physical controllers, Steam client and Steam Deck were not exercised. Rendered inspection does not establish a separate user artistic acceptance.
