# Startup simplification implementation evidence

The [approved proposal](../archive/STARTUP_SIMPLIFICATION_PLAN.md) was implemented in the retained `.worktrees/simplify-startup-plan` checkout on `task/simplify-startup-plan`.

[Architecture](../ARCHITECTURE.md#loading-and-writes), [recovery policy](../UI.md#recovery-and-persistent-failures) and the [startup screen contract](../ui/screens.md#startup-loading) own current behavior.

## Source and behavior

Runtime changes start from main `5bedc267c1b0c83864c50e53cee8f79a12a3357d`. The proposal commit is `ce867df133ee25f1635921c088918a0d53eea4af`. Preparation now validates once inside its existing resources sequence. Fatal rejection records one diagnostic, aborts owned preparation and leaves the existing splash with accessible failure text. Shared splash cleanup stops phrase rotation, the minimum timer and motion listeners; failure also removes decorative animation. Mount lifetime guards suppress late success and failure callbacks.

Review covered validation before save access, handled promise rejection, diagnostic attribution, cancellation during loading, page closure, repeated cleanup, normal minimum timing and separation from rendering recovery. No gameplay, save schema, balance, dependency manifest or lockfile changed.

The change removed the validation retry timer, recursive attempt function and manually settled validation promise. Successful startup timing, artwork batches and timeouts, saved-screen preparation, background warmup, save/Cloud recovery and React rendering recovery retained their existing owners.

## Local checks

The exact startup recovery integration suite passed all five tests in 970ms under the bounded local launcher. It covers initial React render recovery without repeating preparation; persistent invalid content with one diagnostic and no save reads or writes; disposal and page closure before queued rejection handling; and saved-screen completion after disposal. The changed preparation and splash unit suites add focused coverage for deferred resources, unexpected preparation errors and terminal splash cleanup in both motion modes; those suites are deferred to CI.

The lightweight changed-file gate passed formatting, syntax lint, source boundaries and documentation contracts. Compilation, broad tests, builds and hosted CI were not run. Protected integration reruns the lightweight gate on the combined result.

## Rendered review

A task-owned Vite/Chromium preview ran under the shared host lane. Raw evidence, the capture script and source patch remain under `reports/startup-simplification/`. Captures use 1280×720 CSS pixels with 125% text. Browser-only interception of the validation module supplied invalid content; no fault-injection parameter or test behavior was added to production startup.

The captured source is proposal commit `ce867df` plus patch SHA-256 `1c6761e121157a99166d1ba33878f1489cec4b5c156a33e81952b4dab3d5e3e8`. `evidence.json` retains runtime file hashes; `capture.patch` preserves that exact source diff. Only documentation changed after capture.

Inspected `failure-no-preference.png` and `failure-reduce.png` independently at full-frame size. Both show a centered gold wordmark above one readable muted failure message on the existing dark background, with no leaves, clipping, moving fill or rotating text. Computed message and background colors are `rgb(170, 160, 146)` and `rgb(8, 8, 7)`. The status has the failure message as its accessible name and clears its busy state. No running animation remains, including after changing the motion preference. Validation stays at one attempt beyond six seconds and records one internal validation diagnostic.

After removing the interception, reopening with valid content reached the main menu and Continue restored the saved battle in both motion conditions. Inspected `saved-battle.png`: the battlefield, creature artwork, hand, Mana, piles and End turn remain visible at the minimum viewport. The saved checkpoint bytes remained unchanged throughout failure, reopening and Continue; its SHA-256 is `5643afe7cb902c9e03dc96a215ef7970707ffd0f1075681058476274820d2aab`. There were no uncaught browser errors. Owned browser contexts and preview were closed.

This is browser preview and DOM evidence. It does not establish native desktop, Windows packaging, physical controller, Steam-client, Steam-Deck or assistive-technology device verification. No performance improvement or broad visual parity claim is made.
