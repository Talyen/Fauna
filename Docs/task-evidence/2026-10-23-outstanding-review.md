# Outstanding changes review

Reviewed the combined change from remote main `cac9c18109acfe2afc5cef760560bdaf677c5d04` through local main `64dc6f8`, comprising 74 outstanding commits. Scope includes creature content and prepared artwork, shared Food, ability and modifier ownership, draw delivery, save validation, cloud and Steam lifetime, audio ownership, startup, navigation/preferences, conditional combat previews and CI/performance tooling. Source/rendered review found no additional player-facing defect; hosted qualification exposed the static and fixture issues recorded below.

## Local evidence

- `git diff --check origin/main` and the combined changed-file formatting, syntax lint, source and documentation gate passed
- The single focused `tests/unit/game/modifier-contracts.test.ts` run passed all nine tests in 1.65 seconds, including the recorded modifier behavior comparisons; this run used the host Node 24.18.0, with pinned-toolchain qualification deferred to hosted CI
- Fresh quiet Vite/Chromium captures inspected Food targeting, conditional targeting and Collection inspection at 1280×720 with 125% text and 1920×1080 with default text; Settings Battle was inspected at the minimum enlarged-text condition
- All seven captured frames passed layout/error checks and showed readable rules, artwork and controls without clipping
- A separate focused interaction review confirmed Food keyboard cancellation/focus return, Apple healing and Consume, reload/Continue persistence, conditional forecast cancellation, passive tooltip opening/closing and Auto-end turn preference persistence without gameplay mutation; no browser errors occurred

Ignored evidence remains in `.worktrees/outstanding-review-oct23`:

| Evidence                             | Path                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Food targeting                       | `reports/review/outstanding-review-5d81e5f0-a6d8-4f64-8392-8591f916cdad/` |
| Conditional targeting                | `reports/review/outstanding-review-d9eb62de-0d0d-47a4-a418-938ab6d0bd0e/` |
| Collection inspection                | `reports/review/outstanding-review-4b02fd1e-9cce-4659-8355-1460e1c6130e/` |
| Settings Battle                      | `reports/review/outstanding-review-5bba8cec-3d71-4085-979a-14fac555de29/` |
| Interaction record and tooltip frame | `reports/outstanding-review-interactions/`                                |
| Reproduction harness                 | `reports/review-interactions.mjs`                                         |

Each capture directory retains its source/checkpoint identity, conditions, frames and completion record. Capture used reduced motion. The interaction harness used pinned Node 24.22.1. Owned previews and browser contexts were closed. Existing implementation records retain their matching baseline captures and wider interaction evidence; this review does not establish artistic approval, normal-motion parity, measured balance or performance improvement.

## Qualification boundary

The final local source gate and protected integration use pinned Node 24.22.1 and npm 12.2.1. Full compilers, broad unit/DOM tests, exhaustive lineup shards, builds, browser suites and Windows packaging/startup remain hosted-CI gates for the pushed revision. Physical controllers, Steam client/overlay and Steam Deck are untested. This record precedes that final hosted run; its result belongs to the exact pushed commit and run URL in the handoff.

## Hosted follow-up

Initial pushed revision `9e0e8cd` exposed a test-only TypeScript inference failure in nested ownership-map enumeration and three ownership-only function exports that unused-code analysis could not recognize through generic module indexing. The repair gives the test its shared readonly binding shape and names those type-only function references explicitly. It preserves the typed ownership/source contracts and runtime behavior, without excluding exports from analysis. These repairs are qualified by the subsequent pushed revision's complete CI run.

The same run passed all four exhaustive lineup shards and 1,814 regular tests, with three verification tests failing because their temporary repositories omitted the new required modifier suite. Those fixtures now create the declared game-owner suites before checking compiler deferral and missing-suite rejection. Browser execution was blocked by the bundle gate: Linux measured 887,239 bytes and Windows 887,248, against the previous 884,736-byte ceiling. The reviewed modifier-only growth and revised measured allowance are recorded in [bundle history](../archive/BUNDLE_SIZE_HISTORY.md#modifier-ownership-and-shared-parameters). No runtime rules, visual behavior or coverage gate were removed to repair these failures.
