# React Compiler visual review

On October 27, 2026, the user reviewed and approved the React Compiler visual
comparison as sufficient for its tested scope. The approval covers the
production browser comparison at commit `b4015cb0bcf1178fe74a637014f4be49d5f881e2`;
it does not extend the observations below to untested screens or platforms.

Separate production builds with the compiler enabled and disabled completed.
The comparison used headless Chromium, normal motion, isolated seeded saves
and muted audio. Battle attack feedback and the transition from the main menu
to Collection were captured at 1280×720 with 125% text and 1920×1080 with
default text. Finite animations were paused and sampled at matching 40, 120,
240 and 360 ms progress points; an additional larger-viewport pair ran with
uninterrupted playback. The matched first trials had the same animation
definitions and sampled progress. Both modes produced the same battle and
navigation checkpoint hashes, with no browser page errors.

The inspected combat feedback, recoil and navigation transition showed no
consistent compiler-specific visual difference. Raw screenshots were not
pixel-identical: ambient particles varied, and controlled battle captures
intermittently omitted Mana crystals in either build even after their CSS
artwork was decoded. The cause was not established. In the uninterrupted
playback pair, the settled Mana-crystal crops were pixel-identical.

The task-owned builds, harness and screenshots remain under
`reports/production-compiler-parity-b401/` in the retained
`.worktrees/compiler-parity-1027` checkout. Its `REVIEW.md` identifies the
individual evidence directories and conditions. This is not a claim of
pixel-perfect parity for every transient frame or screen, a frame-pacing
measurement, or native desktop, Windows packaging, physical-controller,
Steam-client or Steam Deck verification.
