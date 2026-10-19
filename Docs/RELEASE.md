# Release readiness

Fauna targets Windows x64 on Steam, with controller and Steam Deck experience considered from the foundation. The current app runs offline without Steam, game servers, or accounts.

The GitHub Actions workflow runs Linux static/unit/browser verification and a Windows unpacked build plus Electron startup/resume/isolation smoke test. The Windows executable is produced by electron-builder using the `com.fauna.game` application identity. Builds contain only the renderer, desktop code, and required runtime dependencies.

Before shipping:

- Create Fauna-specific Steam App/depot configuration and credentials; implement optional cloud/achievement adapters against those IDs. Define cloud conflict handling before enabling uploads. Never use Alchemy's identities or saves.
- Add release signing, installer/release identity checks, production artwork and audio, privacy/crash-reporting choices, and store material.
- Validate a complete expedition with physical controllers, including disconnect/reconnect and device prompts. Current browser tests simulate standard gamepad input; prompts use Xbox-style labels.
- Test on Steam Deck hardware through the intended Windows/Proton or native distribution path, including handheld text, overlay, sleep/resume, battery/performance, and offline startup. Native Linux/macOS packaging is not configured.
- Verify Steam client behavior, cloud conflicts/recovery, and packaged quit/resume on Windows. Local macOS Electron testing does not establish Windows packaging or Steam behavior.

No upload, remote publication, automatic promotion, telemetry, or Steam credential handling is configured. Pushes, PRs, Steam delivery, and hosted CI execution require separate authorization. Local integration is authorized after review and verification.
