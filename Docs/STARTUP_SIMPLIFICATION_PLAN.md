# Simplify startup content validation

Proposed against local main `5bedc267c1b0c83864c50e53cee8f79a12a3357d`, October 23, 2026

Validate bundled content once per startup and handle failure explicitly. The current startup retries the same validation every five seconds, although waiting cannot change its inputs. Removing that recovery loop makes startup easier to follow and gives a failed installation a settled outcome instead of an indefinitely animated splash.

## Why this is unnecessary complexity

[Startup preparation](../src/ui/startup/prepare.ts) wraps a synchronous validator in a manually settled promise, schedules another attempt on every exception, and retains a resolver and timer so disposal can release the wait. Session loading starts only after validation succeeds. [Mounting](../src/main.tsx) renders the app only after preparation finishes and the session is ready.

That machinery treats content validation like a temporary storage failure. Its actual production callback, [validateContent](../src/game/content-validation.ts), checks imported cards, species, Talents, Boons and encounter definitions. It performs no network request, storage read or other operation that could recover with time. The [creature catalog](../src/game/content/creatures.ts), [Talents](../src/game/content/talents.ts), [Boons](../src/game/content/boons.ts) and [encounters](../src/game/encounters.ts) freeze their published definitions. A changed development module gets a new startup lifetime through the existing hot-reload disposal in main.

For a persistent validation exception, the preparation promise stays pending, the session never loads, and the splash continues displaying preparation phrases. The [preparation test](../tests/unit/ui/startup/prepare.test.ts) currently demonstrates recovery by making a mocked validator throw once and succeed on the next attempt. That proves the timer works, but does not represent recovery available to the production validator.

This is a source-confirmed redundant recovery path. The assessment did not reproduce a broken production catalog in a rendered game; it does not imply the current authored content is invalid.

## Proposed behavior

Keep one preparation lifetime and its existing cancellation signal. Run content validation once inside its asynchronous preparation sequence, then load the session and prepare essential artwork. Let validation failure reject preparation and handle that rejection at the mounting boundary. Do not introduce a startup state machine, retry service, event bus or additional store.

| Outcome                            | Startup behavior                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Valid content                      | Preserve session loading, the five-second splash minimum, essential artwork and font waits, and reveal after the first app commit |
| Invalid bundled content            | Record the validation failure once, stop preparation, and settle the existing splash into an accessible failure message           |
| Disposal during preparation        | Abort owned work and prevent either app reveal or a late failure message                                                          |
| Save, Cloud, image or font failure | Retain the existing owner's recovery, timeout or fallback policy                                                                  |

The failure message should be **Fauna could not start**. Show it through the existing HTML splash owner, stop its preparation phrases and decorative animation, and clear its busy state. Expose the message to assistive technology. Do not show catalog IDs, exception text or a retry button, and do not imply that waiting will repair the installation. A terminal failure should appear when detected rather than waiting for the success-only splash minimum.

This extends the current startup owner to cover a missing terminal outcome. Update the [recovery policy](UI.md#recovery-and-persistent-failures) and [startup specification](ui/screens.md#startup-loading) together so the exception is explicit. Ordinary presentation recovery remains with GameErrorBoundary and continues to retain the existing session.

## Implementation sequence

### 1. Replace the retry with one validation attempt

In preparation, move validation directly into the resources sequence before `session.load()`. Remove the retry timer, recursive attempt function, validation-only promise and manual completion resolver. Keep cancellation checks around asynchronous work and retain the existing ordering of session loading, essential image preparation and background warmup.

Handle preparation rejection explicitly in `mountGame`; a bare rejected promise would replace the pending splash with an unhandled failure. Ensure validation produces one internal diagnostic and no save reads or writes begin after it fails. The session is currently created before preparation, so this guarantee concerns loading and persistence, not session construction.

### 2. Settle failure through the existing splash owner

Give the splash a small terminal-failure operation alongside dismissal and disposal. Reuse its existing element, typography and cleanup methods. Failure must stop phrase rotation and animation, retain the accessible message, and release unnecessary image preparation. Keep shutdown, hot reload and repeated cleanup safe. Do not route an invalid catalog into the rendering retry boundary or create a second React error screen.

Guard both success and failure callbacks with the mount lifetime. Disposal while loading, a late image completion, or an old startup rejection must never reveal or replace a later screen. Preserve the existing reduced-motion behavior and the normal startup composition.

### 3. Replace the synthetic recovery test

Replace the throw-once validator case with a persistent exception: validation runs once, preparation fails promptly, and advancing fake time does not trigger another attempt. Assert that session loading never begins and no save is written. Retain the existing successful preparation and cancellation coverage.

Extend the [startup recovery integration](../tests/integration/recovery/startup-recovery.test.tsx) to prove the failure is handled, its message is accessible, and disposal prevents a late message. Keep its existing regression that an initial React render failure recovers without repeating content validation or session loading. Extend [splash tests](../tests/unit/ui/startup/splash.test.ts) for stopped phrases, cleared busy state, reduced motion and cleanup after failure.

## Scope and verification

Deliver this as one focused refactor and failure-handling change. Retain runtime content validation, its rules, and CI authoring checks. Preserve successful startup timing, batches of four image loads, image/font deadlines, background warmup, save recovery, Cloud deadlines and rendering retries. No gameplay, save-format, balance or dependency change is needed. Import failures before `mountGame` are a separate boundary and are outside this proposal.

Use the [lightweight verification policy](../CONTRIBUTING.md#verification). During implementation, run one exact focused regression with one worker and a maximum 30-second deadline; do not expand a timeout into more local runs. Hosted CI owns the remaining startup, recovery, session, content, compiler, browser and desktop coverage. Update the existing test ownership map only if file selection needs it.

Because the terminal failure changes presentation, perform the [required rendered review](UI.md#required-review) before integrating implementation. Use a task-owned fault injection to inspect the failure at 1280×720 with 125% text, with ordinary and reduced motion; exercise closing and reopening with valid content. Check the normal saved-journey startup still reveals the right screen. Keep the fault injection out of production startup parameters.

Completion means the validation retry machinery is deleted, persistent invalid content settles visibly without loading saves, disposal suppresses late callbacks, and successful startup and existing recovery retain their contracts. Review the diff and use protected integration. Report local checks, rendered evidence and exact-commit CI separately; no performance improvement is claimed.
