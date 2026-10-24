# Test suite scheduling and setup follow-up

## Evidence scope

The baseline is [successful hosted run 40031187394](https://github.com/Talyen/Fauna/actions/runs/40031187394), commit `cac9c18109acfe2afc5cef760560bdaf677c5d04`. Implementation began from committed local main `d5cb5b5`. This record does not establish hosted results for the new code. Complete compiler, browser, exhaustive lineup and Windows package checks remain CI-owned; physical controllers, Steam client and Steam Deck were not exercised.

## Scheduling

Refreshed all 129 successful browser estimates from that run's coverage-checked `browser-review/ci/browser-durations.json`. Existing discovery still includes new cases using a default weight and the final gate still requires complete coverage. No scenarios or assertions were removed.

Reassigning the recorded test durations offline changes the maximum eight-shard test workload from 94.684 seconds to 79.611 seconds. This is a scheduling projection, excluding setup, test-order effects, contention and future content changes; it is not a measured CI speedup. The raw shard wall times in the source run ranged from 71.3 to 98.1 seconds.

Manual CI supports eight jobs with one worker versus four jobs with two, capped at eight total browser workers. Automatic CI remains eight jobs with one worker pending matched hosted evidence. The final gate checks the worker count read from each executed Playwright report. [CI scheduling](../CI.md#reports-and-scheduling) owns the comparison procedure.

## Animation readiness

Rendered captures sample finite animation readiness inside the browser each frame instead of repeated driver polling. The five-second deadline, real transitions, image decoding, font readiness, layout checks and captures remain. A browser regression covers chained transitions, cancellation followed by replacement, and infinite decoration; its single completion snapshot avoids retrying away an early-return failure. Hosted execution remains pending.

## CLI setup and journal

The complete CLI career and subprocess replay remain. Opt-in profiles separate Vite setup, source hashing, module loading, fixture setup and journey work. Journal append time overlaps fixture/journey work.

On the initial local source, generation and replay each wrote 443 records. Before handle reuse, append observations were 78.9ms and 70.5ms; afterward they were 372.1ms and 66.8ms. Whole focused-suite observations were 2.25s and 2.32s. These single samples are noisy and do not demonstrate a speedup. The structural change removes per-record journal open/close calls while retaining awaited writes and cleanup on success or failure. Stronger assertions verify the initial record and every ordered attempt/completion pair against the full replay.

Ignored evidence is retained in the task worktree under `reports/test-suite-followup/`: original CI timing/estimate/plan data, the offline scheduling projection, and both CLI profiles. CI retains a fresh CLI profile under `unit-results/ci/playthrough-timings.json` for each full regression run.
