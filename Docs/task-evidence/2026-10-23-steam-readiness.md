# Steam readiness — October 23, 2026

The code changes repair native overlay callbacks, initialize overlay graphics before
Electron readiness, honor Big Picture on first launch, add controller-family prompts
and pause an active controller session on disconnect. Full release verification rejects
an unset, invalid or Spacewar App ID. The owner confirmed all shipped player-facing
content was produced using AI; [Store preparation](../STEAM_STORE.md) owns the disclosure
draft and remaining external setup.

## Evidence scope

The retained task checkout is `.worktrees/steam-readiness`. Checks used one heavy process
at a time, one test worker, a 2 GiB Node heap limit and five-minute command deadlines.
Unrelated processes and player profiles were preserved.

- Production renderer build and dependency notice generation passed
- Changed-file formatting, lint, boundaries, all six TypeScript configurations, documentation
  checks and 14 unit/DOM suites passed, covering 114 tests before integration
- All four controller browser scenarios passed across focused runs against the production
  renderer; the new journey covers persisted PlayStation prompts, disconnect pausing,
  stopped autoplay, unchanged progression while paused and reconnect without automatic resume
- Unpackaged macOS Electron smoke passed startup, draft, Collection browsing, knockout
  replacement, formation persistence, last-Mana automatic-turn quit/resume and renderer isolation
- The native smoke loaded the actual Steam SDK flat exports through Koffi without initializing
  Steam; unit coverage exercises callback payload decoding, dispatch, cleanup and early startup
- The smoke fixture now records discovery for its synthetic grown formation, satisfying current
  save validation instead of falling back to an older save

Settings before captures are retained in the main checkout's ignored
`reports/review/steam-before-ac8f9cdc-9f49-484e-a9a4-cf01b54f7329` directory. Accepted after
captures are in the task checkout's ignored
`reports/review/steam-verified-1e672168-92e8-4f73-a09b-b397407fba71` directory. Both full-screen
pairs were inspected at 1280×720 with 125% text and 1920×1080 with default text. The prompt
options fit a two-column layout without clipping. This accepted capture completed without
layout failures or source changes during capture; intermediate attempts are diagnostic only.

The task checkout's ignored
`test-results/controller-manual-controll-e845a-s-without-changing-progress` directory retains
inspected `playstation-battle.png` and `playstation-controls.png` browser screenshots at
1280×720 with 125% text. The Triangle End turn hint and controller-only glossary instructions
fit and remain readable.

The protected integration command reruns required local checks on the combined tree; its
result must be reported separately from these pre-integration observations. Hosted CI,
packaged Windows, a real Steam client, two-device Cloud, physical controllers, Proton and
Steam Deck remain unverified. No App ID or Store page exists yet. Offline macOS and browser
evidence do not qualify those external release gates.
