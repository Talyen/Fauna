# Twenty boundary and lifecycle fixes

The audit covers four combat/draw issues, nine Cloud construction and reconciliation issues, four diagnostic/instrumentation issues and three save-validation issues. Each numbered scenario has an assertion in [the focused regression suite](../../tests/unit/application/audit-twenty.test.ts). The findings include internal API and malformed-input contract failures; they are not twenty ordinary player-flow defects.

| #   | Failure scenario                                                                                                  | Correction and consequence                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Applying zero Stun buildup spends Nullify or rolls Reflect even though no status can be gained                    | Reject nonpositive harmful applications before protection, events or RNG                                      |
| 2   | Calling Blind or periodic-status application with a fallen source still adds a new effect                         | Cancel new applications from fallen actors; existing periodic damage retains its separate provenance policy   |
| 3   | A keyword draw with no eligible Draw/Discard card reports an unknown hidden decision                              | Establish that the eligible pool exists before recording a hidden draw                                        |
| 4   | Drawing zero cards still promotes overflow and shuffles Discard, advancing RNG                                    | Zero-count draw returns without changing piles or RNG                                                         |
| 5   | Snapshot construction returns invalid device IDs or zero/unsafe sequence counters that decoding rejects           | Validate constructed snapshots with the decoder's structural schema                                           |
| 6   | Snapshot construction can claim a different account profile's snapshot as an ancestor                             | Reject cross-profile parents before creating metadata                                                         |
| 7   | Sixty-five direct competing heads silently lose one head when ancestry is sliced to 64                            | Refuse that reconciliation instead of fabricating complete ancestry; keep alternatives separate               |
| 8   | Startup with a valid gameplay checkpoint and different valid Cloud metadata overwrites the unmatched metadata     | Preserve the alternative durably before writing replacement metadata; preservation failure leaves it intact   |
| 9   | Explicit retry after an identity or metadata-read failure invokes reconciliation without initializing identity    | Select initialization or reconciliation according to lifecycle and retain the startup timeout                 |
| 10  | A stale standalone-import capability can replace an already intact profile checkpoint                             | Import only when profile progress is missing; inspect local metadata first                                    |
| 11  | A stalled installation prevents the five-second startup deadline from completing                                  | Revoke the installation's generation lease on timeout; session checks the lease before writing and publishing |
| 12  | An earlier upload reports Synced while newer local metadata is still being hashed/written                         | Publish Syncing for newer local progress and acknowledge only the matching payload                            |
| 13  | Missing gameplay slots start fresh despite a valid complete save embedded in local Cloud metadata                 | Preserve and install the validated local checkpoint before considering remote or standalone progress          |
| 14  | Diagnostic phase context bypasses the redaction applied to messages, including on reload                          | Redact selected context before truncation, publication and persistence                                        |
| 15  | A diagnostic listener added during notification runs immediately and can keep extending the current delivery loop | Snapshot subscriptions for each notification; new subscriptions wait for the next record                      |
| 16  | A throwing context accessor escapes diagnostic recording and suppresses the original failure                      | Isolate optional context inspection and retain the original message                                           |
| 17  | Releasing an inner performance recorder disables a still-installed outer recorder                                 | Retain active installations by ownership and restore the latest remaining installation                        |
| 18  | A draft save carries journey-only Boons into the next journey                                                     | Reject it so ordinary save-candidate recovery can select an intact checkpoint                                 |
| 19  | A destination or other ongoing journey resumes with every roster creature fallen                                  | Reject non-defeat lifecycle payloads without a living roster member                                           |
| 20  | Active Stun/Freeze resumes with positive buildup of the same status, despite threshold consumption                | Validate that active control has consumed its own buildup                                                     |

The same subscription review also made duplicate diagnostic subscriptions independently removable, revoked new subscriptions after disposal, and released session subscribers after admitted notifications finish. These small ownership corrections are included in the focused suite without counting them as additional numbered findings.

## Evidence scope

- Source inspection established the original failure paths; the unmodified baseline suite was not executed
- The first focused run passed 19 assertions and exposed two fixture comparisons using noncanonical save JSON ordering; fixtures were corrected to use the existing decode/encode contract
- The next focused run passed all 23 regressions, one worker, within the repository's 30-second limit; this includes production-session timeout/offline-save ordering and preservation-failure coverage
- No UI layout, artwork or interaction controls changed; no rendered inspection was performed
- Full compilation, broad unit/DOM suites, browser journeys, desktop, Windows packaging, physical controllers, Steam client and Steam Deck remain unverified locally and require their respective CI or device gates
- Pushes and publication were not requested; hosted CI cannot establish exact-commit results until the changes are uploaded through an authorized workflow

[Architecture](../ARCHITECTURE.md) remains the owner of the persistence, Cloud and diagnostics contracts. [Keywords](../KEYWORDS.md) owns combat semantics. This record describes the scenarios and verification scope rather than introducing new mechanics.
