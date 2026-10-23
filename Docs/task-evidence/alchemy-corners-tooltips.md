# Alchemy corners and hover tooltips

On 2026-10-23, the user requested Alchemy's rounded corners and hover tooltip styling for Fauna. The source reference was the clean Alchemy checkout at `2a8c6b246ac8ac51c409edea54f24fc32ae8a824`: `Alchemy/src/styles/theme.css`, `Alchemy/src/styles/components.css`, `Alchemy/src/components/ui/button.tsx` and shared tooltip layout/typography configuration.

Fauna now uses ordinary rounded corners with Alchemy's fixed role values: controls 12px, compact faces 14px, tooltips 20px, popovers 22px, dialogs 26px and artwork 30px. Tooltip fill, foreground, muted text, border, shadow, 12px padding, 320px width cap, 18px heading, 16px body and 180/120ms entry/exit durations match the reference at standard scale. Tooltip size remains a player preference; reduced motion suppresses animation. The measured-corner observer and its obsolete tests were removed; modal inertness and forwarded control refs remain with their existing owners.

## Rendered evidence

The retained task checkout is `.worktrees/alchemy-corners-tooltips`. Evidence paths below are relative to that checkout and are ignored artifacts, not published assets.

- Baseline: `reports/review/before-alchemy-style-f4fd467a-95c5-44d4-9b43-b21403559018/evidence.json`
- Final combined state: `reports/style-review/after-combined/evidence.json`
- Final frames: `reports/style-review/after-combined/collection-1280.png`, `hover-1280.png`, `inspection-1280.png`, and the corresponding `1920` frames in that directory
- Reproduction script: `reports/style-review/capture.mjs`, invoked with label `after-combined` through the shared host admission helper

Both runs use the Collection fixture, seed 42 and checkpoint hash `005f3bf0b1774eb8777f2c4de2db5f5f52ac2745db450615566c2153ec181074`. Conditions are 1280×720 at 125% text and 1920×1080 at default text, default Tooltip size and reduced motion. Collection composition and tooltip text were inspected at both sizes, along with the creature inspection flow. The final state includes main's separate `d90f6fe` creature artwork enlargement, which was preserved during integration preparation; the earlier matching-size baseline comparison predates that independent change.

The focused preview exercised hover details, click dismissal, opening inspection, Escape, focus return and intentional keyboard focus details at both sizes. Computed artwork/tab/tooltip/dialog radii matched the fixed roles. Collection/tooltip layout checks reported no violations or browser errors. Text and keyword colors remain readable against the tooltip fill; the artwork, reading order and controls remain visible within the frame. This review establishes implementation evidence for the requested reference; it does not record a separate artistic approval from the user.

Earlier diagnostic attempts remain in `reports/style-review`: one attempted to hover a noninteractive locked Collection entry, and one completed both views but compared a Vite-mutated environment against its initial environment. The latter's recorded initial source hash was independently confirmed unchanged. The final reproduction snapshots the environment before starting Vite, matching the repository capture helper.

## Verification boundary

The exact tooltip unit suite passed all six regressions. Changed-file formatting, syntax lint, source contracts and documentation checks passed before integration; protected integration runs the required final lightweight gate. Full static checks, the updated browser suite, desktop/Windows packaging, physical controllers, Steam client and Steam Deck remain CI or platform verification boundaries. No push or publication was requested.
