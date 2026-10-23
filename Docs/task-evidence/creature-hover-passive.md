# Creature hover passive details

On October 23, 2026, the user requested creature tooltips containing only the creature name, passive trait and trait icon, with the trait name and icon sharing keyword-colored text shine. The shared creature details now render that content, including current passive ranks. Starters and optional Recruit destinations use the same details instead of ability lists. Named enemies and Legendary creatures omit kit and rarity labels. Echo minions have no passive and show only their name. Combat readouts, status icons outside tooltips and full creature inspection retain their existing roles.

## Evidence and review

Retained checkout: `.worktrees/creature-hover-passive`. The following paths are relative to that checkout and contain ignored local artifacts.

- Matching baseline and implementation frames: `reports/creature-hover/before.json` and `after.json`, with Collection and battle PNGs at both sizes in that directory
- Additional starter and enemy frames: `reports/creature-hover/after-starter-1280.png` and `after-enemy-1280.png`
- Reproduction: `reports/creature-hover/review.mjs` and `extra.mjs`

The matching runs use seed 42, checkpoint hash `005f3bf0b1774eb8777f2c4de2db5f5f52ac2745db450615566c2153ec181074`, 1280×720 at 125% text and 1920×1080 at default text, default Tooltip size and reduced motion. The baseline is `d90f6fe`; implementation frames have the source content committed as `e624a00`. The whole-frame review found readable name/trait/rules hierarchy and visible icon, no clipping, and no layout assertions or browser errors. Hover opens, pointer leave closes, intentional keyboard focus opens, and Escape closes tooltips at both sizes. Starter activation opens full inspection; Escape restores focus to the creature. Armor/Burn passive shine uses both colors, while Mossguard's trait uses Block rather than unrelated kit keywords. Reduced motion freezes the shared gradient.

The additional diagnostic run saved both frames and then failed its normal-motion assertion: both text and icon had the expected `effect-text-shine` animation but were paused by the existing inactive-window policy. This does not establish a normal-motion visual pass. Its source identity and diagnostic remain in `reports/creature-hover/extra.json`.

## Current completion boundary

Main's separate Alchemy corners and tooltip styling changes were merged cleanly into the task at `2be2f6b`. The combined source was reviewed and the exact `tests/unit/ui/inspection.test.tsx` regression passed all 13 tests in 1.50 seconds. The final bounded preview command, `node reports/creature-hover/final.mjs`, was denied admission because the shared host lane was occupied; it launched no browser or preview. The earlier images predate the merged shared styling, so current rendered evidence remains deferred and local integration is blocked by the UI review contract. The branch and evidence are retained; main was not advanced by this task.

Full static checks, other DOM suites, the updated onboarding browser suite, native desktop/Windows packaging, physical controllers, Steam client and Steam Deck remain unverified. No push or publication was requested.
