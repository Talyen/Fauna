# JavaScript bundle size history

These measurements record earlier builds and allowance decisions. The current values are owned by [the budget definition](../../scripts/checks/bundle-budget.mjs); [the script map](../../scripts/README.md#bundle-allowance) describes the current check. Size measurements do not establish full CI, rendered, performance or release acceptance.

## Recruitment and recovery

The baseline was 723,971 uncompressed JavaScript bytes, measured by the Linux build job for `8e71051` in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/39724680077) on October 21, 2026. The preceding reaction implementation measured 720,806 bytes at `7f54744` and fit the former 704 KiB allowance. The combined Recruit-destination, three-item Boon Merchant and recovery changes add 3,165 bytes: explicit destination state/validation, destination controls, stock pagination and lifecycle checks. Source review found no new dependencies or duplicate production ability interpreter. Reaction dispatch was compacted before this measurement rather than increasing the allowance for redundant execution code.

This replaced the 670,024-byte UI/recovery baseline for `be2510d`, recorded in [the prior hosted run](https://github.com/Talyen/Fauna/actions/runs/39653514705). The allowance was 760 KiB, retaining about 7.5% headroom with a warning at 95%. The measurement establishes size only: the measured run failed test-fixture type checks and the former size gate, so it does not establish browser or release acceptance. CI still measures the exact pushed commit.

## Stable stack upgrade

The stable-stack upgrade measured 774,677 uncompressed JavaScript bytes in [hosted CI](https://github.com/Talyen/Fauna/actions/runs/39725532685) for `a70dd37`. The production build succeeded before the previous allowance rejected it. Inspection of the published package contents found React DOM client production code growing from 536,016 to 625,168 bytes between 19.2.5 and 19.3.1, with additional Zod and Immer growth. The upgrade adds no production dependencies. The measured allowance became 800 KiB (about 5.7% headroom); all chunks remain counted. This is bundle evidence only, not performance acceptance.
