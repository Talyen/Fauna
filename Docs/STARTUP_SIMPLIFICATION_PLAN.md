# Startup validation simplification

The [approved proposal](archive/STARTUP_SIMPLIFICATION_PLAN.md) is implemented. [Architecture](ARCHITECTURE.md#loading-and-writes), [recovery policy](UI.md#recovery-and-persistent-failures) and the [startup screen contract](ui/screens.md#startup-loading) own the current behavior.

Startup validates bundled content once before loading saves. The validation retry timer, recursive attempt function and manually settled validation promise are removed. Preparation rejects on fatal failure; mounting cancels owned work and the existing splash shows an accessible static failure message. Shared splash cleanup stops timers and motion listeners. Disposal suppresses late success and failure callbacks.

The successful startup minimum, artwork batches and timeouts, saved-screen preparation, background warmup, save/Cloud recovery and React rendering recovery retain their existing owners. No gameplay, save format or dependencies changed.

The [implementation evidence](task-evidence/2026-10-23-startup-simplification.md) records the focused regression, rendered failure and saved-battle review, source identities and remaining verification boundaries.
