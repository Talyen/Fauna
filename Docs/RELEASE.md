# Release readiness

Fauna targets Windows x64 on Steam, with controller and Steam Deck experience considered from the foundation. The current app runs offline without Steam, game servers, or accounts.

The GitHub Actions workflow runs `npm run verify:full` on Linux for full static and documentation checks, all Node/DOM unit suites, a production build, its JavaScript allowance and browser journeys, plus a Windows unpacked build, package integrity verification and Electron startup/resume/isolation smoke test. CI publishes compact unit/browser failure summaries and evidence paths in the job summary. Missing reports are marked unavailable rather than treated as passing. The lightweight local `npm test`, `npm run check` and `npm run verify` gates do not replace CI. Linux skips the unused Electron binary download; Windows installs the binary needed for packaging and native smoke. CI retains rendered screenshots and failure traces in the `browser-review` artifact for seven days, including successful runs. The Windows executable is produced by electron-builder using the `com.fauna.game` application identity. Builds contain only the renderer, desktop code, and required runtime dependencies.

Before shipping:

- Create Fauna-specific Steam App/depot configuration and credentials; implement optional cloud/achievement adapters against those IDs. Define cloud conflict handling before enabling uploads. Never use Alchemy's identities or saves.
- Add release signing, installer acceptance, production artwork and audio, privacy/crash-reporting choices, and store material.
- Validate a complete journey with physical controllers, including disconnect/reconnect and device prompts. Current browser tests simulate standard gamepad input; prompts use Xbox-style labels.
- Test on Steam Deck hardware through the intended Windows/Proton or native distribution path, including handheld text, overlay, sleep/resume, battery/performance, and offline startup. Native Linux/macOS packaging is not configured.
- Verify Steam client behavior, cloud conflicts/recovery, and packaged quit/resume on Windows. Local macOS Electron testing does not establish Windows packaging or Steam behavior.

No upload, remote publication, automatic promotion, telemetry, or Steam credential handling is configured. Pushes, PRs, Steam delivery, and hosted CI execution require separate authorization. Local integration is authorized after review and verification.

## Packaged integrity

`npm run verify:package -- release/win-unpacked` reads an existing Windows x64 artifact without building, modifying or publishing it. Windows CI runs it after packaging and before startup smoke. It verifies PE architecture, Fauna package identity/version, required Electron runtime files, ASAR paths, exact runtime/preload source bytes and sandbox configuration, relative nonempty renderer references, exact renderer bytes against the matching existing `dist/` build, and prepared media hashes against validated receipts. Every renderer JavaScript chunk is checked for accidental development controls. Packaged startup ignores `FAUNA_DEV_URL`, and production sessions never enable development victory.

Set `RELEASE_TAG` explicitly to check the package version against that tag; no tag is required for ordinary package verification. Missing, empty, corrupt, mismatched and escaping resources fail. Passing structural checks is separate from Windows startup/resume smoke, installer/signing acceptance and Steam delivery. Electron fuse settings are unchanged.

Native performance uses an unpackaged production renderer in isolated profiles. Cold captures measure a new process/profile with ordinary OS caches; they do not replace packaged Windows startup, physical controller, Steam client or Steam Deck review. See [performance scenarios](DEVELOPMENT_TOOLS.md#native-and-reachable-performance-scenarios).
