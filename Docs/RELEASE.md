# Release readiness

Fauna targets Windows x64 on Steam, with controller and Steam Deck experience considered from the foundation. The current app runs offline without Steam, game servers, or accounts.

The [GitHub Actions workflow](../.github/workflows/ci.yml) runs full static/documentation/content checks, all Node/DOM unit suites, a shared Linux production build, eight browser shards and seeded interaction replay. Windows independently builds and verifies an unpacked x64 package and runs Electron startup/resume/isolation smoke. The final `verify` gate requires complete results from the current workflow attempt, including every discovered browser case. Unexpected skips and missing reports fail it. See [verification policy](../CONTRIBUTING.md#verification) for commands and reruns.

CI publishes compact unit/browser failure summaries. The `browser-review` artifact contains merged JSON with portable evidence paths and an HTML report; `browser-shard-N` artifacts retain raw screenshots, traces and blob reports. All have seven-day retention, including successful runs. The lightweight local gates do not replace CI. Linux skips the unused Electron binary download; Windows installs the binary needed for packaging and native smoke. The Windows executable uses electron-builder and the `com.fauna.game` application identity. Builds contain only the renderer, desktop code and required runtime dependencies.

Before shipping:

- Configure Fauna's own Steam App/depot and Cloud quota, then set its App ID in `desktop/steam-config.json`. Optional cloud and overlay adapters are implemented with isolated account profiles and automatic conflict resolution. Live client, two-device divergence/recovery, callback support and native binary qualification remain required. Achievements are not implemented. Never use Alchemy's identities or saves.
- Add release signing, installer acceptance, production artwork and audio, privacy/crash-reporting choices, and store material.
- Validate a complete journey with physical controllers, including disconnect/reconnect and device prompts. Current browser tests simulate standard gamepad input; prompts use Xbox-style labels.
- Test on Steam Deck hardware through the intended Windows/Proton or native distribution path, including handheld text, overlay, sleep/resume, battery/performance, and offline startup. Native Linux/macOS packaging is not configured.
- Verify Steam client behavior, cloud conflicts/recovery, and packaged quit/resume on Windows. Local macOS Electron testing does not establish Windows packaging or Steam behavior.

No release upload, remote publication, automatic promotion, telemetry, or Steam credential handling is configured. Progress sync remains unavailable until Fauna's own Steam App ID is configured. Task-scoped repository pushes, hosted CI and local integration follow the authorization in [AGENTS.md](../AGENTS.md#worktrees-and-integration). PRs, release publication and Steam delivery require separate authorization.

## Packaged integrity

Windows packaging explicitly disables electron-builder publication. The hardening hook applies the optional Wasm trap-handler fuse only when the Electron binary exposes it; mandatory fuse settings and rejection of unknown or incomplete wires remain strict.

`npm run verify:package -- release/win-unpacked` reads an existing Windows x64 artifact without building, modifying or publishing it. Windows CI runs it after packaging and before startup smoke. It verifies PE architecture, Fauna package identity/version, required Electron runtime files, ASAR paths, exact runtime/preload source bytes and sandbox configuration, relative nonempty renderer references, exact renderer bytes against the matching existing `dist/` build, and prepared media hashes against validated receipts. Every renderer JavaScript chunk is checked for accidental development controls. Packaged startup ignores `FAUNA_DEV_URL`, and production sessions never enable development victory.

Set `RELEASE_TAG` explicitly to check the package version against that tag; no tag is required for ordinary package verification. Missing, empty, corrupt, mismatched and escaping resources fail. Passing structural checks is separate from Windows startup/resume smoke, installer/signing acceptance and Steam delivery. The after-pack hook disables Node execution/environment/inspection paths, requires ASAR loading, enables supported ASAR integrity, and prepares browser-specific V8 snapshots. The gate reads the executable fuse wire and snapshot bytes and checks native Steam module packaging. File-protocol privileges remain enabled for Fauna's existing trusted local renderer; disabling them requires a separately verified protocol replacement. Platform integrity enforcement and startup still require the exact artifact tests.

Native performance uses an unpackaged production renderer in isolated profiles. Cold captures measure a new process/profile with ordinary OS caches; they do not replace packaged Windows startup, physical controller, Steam client or Steam Deck review. See [performance scenarios](DEVELOPMENT_TOOLS.md#native-and-reachable-performance-scenarios).

## Steam qualification

Use application-managed Cloud only for the versioned Fauna device-slot namespace; do not also Auto-Cloud the same progression directories. Confirm configured quota supports 32 device streams with two 1 MiB slots each. Device snapshots carry current-format payload hashes and bounded ancestry; unrelated or unprovable heads automatically prefer intact local progress, then stable snapshot-ID order, after durable preservation. Offline startup and failed reads never authorize overwriting unknown remote progress. Settings, audio preferences and diagnostics are device-local. Client-free launch continues the last local profile without uploading; a different identified Steam account never adopts that profile automatically.

Smoke/preview/performance profiles explicitly bypass Steam. Live acceptance requires two actual devices, offline divergent journeys, automatic conflict resolution and preservation of all competing heads, account switching, disabled Cloud, reconnect and graceful quit. Verify overlay activation through the client and physical controller, including Deck sleep/resume and custom bindings. A fake event test establishes lifecycle behavior only. Keep Steam configuration, signing and publication separately authorized.

## Release verification and player notes

`npm run verify:release-version` checks Fauna's application identity and exact package/lock version agreement without building. An optional `--tag v0.1.0`, or `RELEASE_TAG`, must match the package version exactly. The static and Windows CI jobs run this before their existing validation/build commands, passing the version tag on tagged pushes. Windows CI also runs the full artifact release gate for version tags.

Every Vite production build records its full commit, Git tree, package version and dirty-checkout status. A source change during the build marks the receipt dirty. Ordinary development builds remain possible, but release verification rejects dirty or stale receipts. Packaging already verifies exact renderer and media bytes against the matching existing build, including this receipt.

For an already tagged, built and packaged candidate, run:

```sh
npm run verify:release -- --tag v0.1.0 --package release/win-unpacked
```

This read-only gate requires clean source, an existing tag identifying HEAD, a matching clean renderer receipt and the existing Windows package-integrity checks. It does not create a tag, build, sign, run tests, upload or promote anything. Build and package from the final clean tagged commit through the existing authorized local or CI workflow. A version bump requires both package manifests; no bump or release is performed by these tools. Passing this gate establishes artifact identity and integrity, not green CI, installer/signing acceptance, Steam behavior or hardware qualification. Package replacement during verification is outside the gate's scope; retain and distribute the verified immutable CI artifact.

Generate player-facing draft notes from committed history:

```sh
npm run generate:patch-notes -- --dry-run
npm run generate:patch-notes
npm run generate:patch-notes -- --tag v0.1.0 --dry-run
```

Without a tag, the range starts at the nearest reachable release tag and ends at HEAD. For a tagged release, use the nearest preceding reachable release tag. Unrelated tags and tag dates do not move the range. Without a preceding release, all reachable non-merge commits are considered. Uncommitted edits are excluded. Drafts are written under ignored reports in the release-notes subdirectory, keeping the verified checkout clean; dry-run prints without writing.

Conventional `feat`, `balance`, `fix` and `perf` commits touching player runtime/content produce New, Balance, Fixes and Performance sections. Tooling-only commits are omitted. A `Player-Note: <player-facing sentence>` commit trailer supplies explicit wording and inclusion; `User-Facing: yes` includes other commit types under Changes, and `User-Facing: no` always excludes a commit. Duplicate lines are collapsed. Review the generated wording before publication; commit subjects are a fallback, not editorial approval. Linux CI fetches complete history and retains the draft in the seven-day `player-notes` artifact, including when later validation fails.

Patch-note generation and verification never publish. Task-scoped repository pushes and hosted CI follow AGENTS.md. Release tags, release signing/setup, Steam delivery and public promotion remain separately authorized.

## Display acceptance

The minimum supported renderer content viewport is 1280×720 CSS pixels. Review that size, 1280×800, 1920×1080, 2560×1080 and 3440×1440 at normal and 125% text, including the largest tooltip setting. No screen or nested surface may scroll. Include windowed/fullscreen transitions, restored window bounds, monitor removal and high-DPI displays; native frame size and OS scaling must not be mistaken for renderer viewport size. Smaller work areas are unsupported. Browser layout coverage does not establish packaged Electron, physical controller, Steam client or Steam Deck acceptance. See [required rendered review](UI.md#required-review).
