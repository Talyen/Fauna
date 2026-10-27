# JavaScript bundle size history

These measurements record earlier builds and allowance decisions. The current values are owned by [the budget definition](../../scripts/checks/bundle-budget.mjs); [the script map](../../scripts/README.md#bundle-allowance) describes the current check. Size measurements do not establish full CI, rendered, performance or release acceptance.

## Recruitment and recovery

The baseline was 723,971 uncompressed JavaScript bytes, measured by the Linux build job for `8e71051` in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/39724680077) on October 21, 2026. The preceding reaction implementation measured 720,806 bytes at `7f54744` and fit the former 704 KiB allowance. The combined Recruit-destination, three-item Boon Merchant and recovery changes add 3,165 bytes: explicit destination state/validation, destination controls, stock pagination and lifecycle checks. Source review found no new dependencies or duplicate production ability interpreter. Reaction dispatch was compacted before this measurement rather than increasing the allowance for redundant execution code.

This replaced the 670,024-byte UI/recovery baseline for `be2510d`, recorded in [the prior hosted run](https://github.com/Talyen/Fauna/actions/runs/39653514705). The allowance was 760 KiB, retaining about 7.5% headroom with a warning at 95%. The measurement establishes size only: the measured run failed test-fixture type checks and the former size gate, so it does not establish browser or release acceptance. CI still measures the exact pushed commit.

## Stable stack upgrade

The stable-stack upgrade measured 774,677 uncompressed JavaScript bytes in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/39725532685) for `a70dd37`. The production build succeeded before the previous allowance rejected it. Inspection of the published package contents found React DOM client production code growing from 536,016 to 625,168 bytes between 19.2.5 and 19.3.1, with additional Zod and Immer growth. The upgrade adds no production dependencies. The measured allowance became 800 KiB (about 5.7% headroom); all chunks remain counted. This is bundle evidence only, not performance acceptance.

## Keyword visual effects

A local production comparison on October 22, 2026 used the same Node/npm dependencies and Vite configuration. A read-only archived snapshot of committed `c695e34` measured 812,706 uncompressed JavaScript bytes. The keyword effects implementation measured 836,542 bytes, an increase of 23,836 bytes (2.9%). The additions are the native WebGL plasma shader and context lifecycle, Canvas 2D ember lifecycle, scoped presentation sources, palette resolution, CSS shine compositions and device controls; no production dependency was added. The small Mana artwork fix reuses prepared asset URLs.

The allowance is 864 KiB, retaining about 5.8% headroom above this local feature measurement with the existing 95% warning. Both builds count every JavaScript chunk; the archived baseline and build logs remain in the task checkout's ignored reports. The measured source was reviewed for duplicate renderers and unnecessary dependencies. This is local bundle evidence, not hosted CI or physical GPU acceptance; CI still measures the exact pushed commit.

## Modifier ownership and shared parameters

The Linux build for green revision `761455f` measured 863,851 bytes in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/40066657562). Revision `9e0e8cd` measured 887,239 bytes on Linux and 887,248 on Windows in [the review run](https://github.com/Talyen/Fauna/actions/runs/40070022623), exceeding the former ceiling by about 2.5 KiB. The Linux increase is 23,388 bytes (2.7%). Source comparison between those revisions contains the modifier ownership catalog, shared Boon/Talent parameters and their consumers; package manifests and the dependency lockfile are unchanged. Existing execution owners remain authoritative; the ownership catalog is data and does not introduce another combat interpreter or renderer.

The measured baseline is now the larger Windows observation, 887,248 bytes. The allowance is 920 KiB, about 6.2% above that baseline, with the existing 95% warning and all JavaScript chunks still counted. This updates the allowance for the reviewed feature growth. The measured run failed static/test-fixture and former-size gates, so these measurements establish size only; subsequent exact-commit CI must qualify the repaired revision. No frame-pacing or device-performance result is implied.

## Combined Boons and combat changes

The Linux build for `ec1e240e` measured 943,144 uncompressed JavaScript bytes in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/40414373252), 55,896 bytes above the previous Windows baseline. The outstanding range adds 49 Boons and their combat interactions, expanded content and save validation, cloud recovery and gameplay boundary fixes; the package manifest and dependency lockfile are unchanged. The shared combat resolver remains the execution owner, with no second interpreter or renderer. The build completed but failed the previous 920 KiB allowance.

The same run measured 943,153 bytes on Windows. The larger measured baseline is 943,153 bytes and the allowance is 980 KiB, about 6.4% headroom, with the existing 95% warning and all JavaScript chunks counted. This measurement establishes bundle size only; the repaired commit still requires its own CI and does not establish runtime performance.

## Localization catalogs

The English-only Linux build for `12ec98c9` measured 991,285 uncompressed JavaScript bytes in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/40564504511). The seven reviewed runtime catalogs total 1,985,196 UTF-8 bytes when serialized without authoring hashes and review flags. They retain source text for stale-translation fallback. Adding those figures gives an estimate of 2,976,481 bytes before differences from bundling and subsequent local-main changes. The provisional allowance is 3,328 KiB with the existing 95% warning. The qualified production bundle has not been measured, and this estimate does not establish build, startup performance or platform acceptance.
