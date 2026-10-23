# Release readiness

Fauna targets Windows x64 on Steam, with controller and Steam Deck experience considered from the foundation. The current app runs offline without Steam, game servers, or accounts.

[CI](CI.md) owns automated coverage, exact-commit/build identity, reruns and retained artifacts. Windows produces an unpacked x64 package using electron-builder and `com.fauna.game`, containing only the renderer, desktop code and required runtime dependencies. Automated checks support the candidate qualification below; they do not establish hardware acceptance.

Use the [candidate qualification record](RELEASE_QUALIFICATION.md) to retain exact artifact identity, setup and manual Windows, Steam, controller and Deck evidence.

Before shipping:

- Configure Fauna's own Steam App/depot and Cloud quota, then set its App ID in `desktop/steam-config.json`. Optional cloud and overlay adapters are implemented with isolated account profiles and automatic conflict resolution. Live client, two-device divergence/recovery, callback support and native binary qualification remain required. Achievements are not implemented. Never use Alchemy's identities or saves.
- Qualify the unsigned Windows build through the intended Steam depot on clean Windows, including Windows 11 Smart App Control. Paid Authenticode signing is deferred; revisit it if native qualification exposes blocks or direct-download distribution is planned. Complete production artwork and audio, privacy/crash-reporting choices, and store material.
- Validate a complete journey with physical controllers, including disconnect/reconnect and device prompts. Current browser tests simulate standard gamepad input; prompts use Xbox-style labels.
- Test on Steam Deck hardware through the intended Windows/Proton or native distribution path, including handheld text, overlay, sleep/resume, battery/performance, and offline startup. Native Linux/macOS packaging is not configured.
- Verify Steam client behavior, cloud conflicts/recovery, and packaged quit/resume on Windows. Local macOS Electron testing does not establish Windows packaging or Steam behavior.

No release upload, remote publication, automatic promotion, telemetry, or Steam credential handling is configured. Progress sync remains unavailable until Fauna's own Steam App ID is configured. Git and external-action authorization belongs to [AGENTS.md](../AGENTS.md#worktrees-and-integration).

## Packaged integrity

Windows packaging explicitly disables electron-builder publication. The hardening hook configures every Electron 45 fuse, including the Wasm trap handler, and strictly rejects unknown or incomplete fuse wires.

`npm run verify:package -- release/win-unpacked` reads an existing Windows x64 artifact without building, modifying or publishing it. Windows CI runs it after packaging and before startup smoke. It verifies PE architecture, Fauna package identity/version, required Electron runtime files, ASAR paths, exact runtime/preload source bytes and sandbox configuration, relative nonempty renderer references, exact renderer bytes against the matching existing `dist/` build, and prepared media hashes against validated receipts. Every renderer JavaScript chunk is checked for accidental development controls. Packaged startup ignores `FAUNA_DEV_URL`, and production sessions never enable development victory.

Set `RELEASE_TAG` explicitly to check the package version against that tag; no tag is required for ordinary package verification. Missing, empty, corrupt, mismatched and escaping resources fail. Passing structural checks is separate from Windows startup/resume smoke, installer/signing acceptance and Steam delivery. The after-pack hook disables Node execution/environment/inspection paths, requires ASAR loading, enables supported ASAR integrity, and prepares browser-specific V8 snapshots. The gate reads the executable fuse wire and snapshot bytes and checks native Steam module packaging. Its runtime inventory follows the official Electron 45 Windows archive, including `electron_wer.dll`; obsolete ANGLE and DXIL DLL names are not required. File-protocol privileges are disabled; the renderer loads through the confined `fauna://app/` protocol. Platform integrity enforcement and startup still require the exact artifact tests.

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

Patch-note generation and verification never publish. Release tags, signing/setup, Steam delivery and public promotion require separate authorization under AGENTS.md.

## Display acceptance

The minimum supported renderer content viewport is 1280×720 CSS pixels. Review that size, 1280×800, 1920×1080, 2560×1080 and 3440×1440 at normal and 125% text, including the largest tooltip setting. Gameplay, artwork browsing and tooltips fit without scrolling. Glossary, Settings panels and help dialogs may use the named, bounded vertical reading regions defined in the [UI contract](UI.md#layout-artwork-size-and-spacing); verify their full contents are reachable with mouse, keyboard and controller. Include windowed/fullscreen transitions, restored window bounds, monitor removal and high-DPI displays; native frame size and OS scaling must not be mistaken for renderer viewport size. Smaller work areas are unsupported. Browser layout coverage does not establish packaged Electron, physical controller, Steam client or Steam Deck acceptance. See [required rendered review](UI.md#required-review).

## Candidate signing and qualification

The current distribution decision is an unsigned Windows Steam build, with no paid signing service or Azure subscription. Steam acceptance and Windows security behavior are separate: unfamiliar unsigned binaries can still be blocked by Smart App Control or antivirus. Validate the actual depot on clean Windows with normal protections enabled; a launch block is an unresolved qualification failure. See [Microsoft reputation guidance](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation).

The signed installer workflow below is optional future infrastructure, not a requirement to obtain the ordinary Windows CI artifact or qualify the Steam candidate. No certificate or signing environment is currently configured.

The manually dispatched [signed candidate workflow](../.github/workflows/release-candidate.yml) requires successful full CI for an existing version tag, including the exact commit’s successful final `verify` job, then builds it, signs the executable and NSIS installer, verifies Authenticode and package identity, runs packaged smoke and retains candidate artifacts without publication. Configure `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` in the protected `release-signing` GitHub environment before dispatch; missing secrets fail rather than producing an unsigned candidate. The [CI prerequisite checker](../scripts/release/require-ci.mjs) pins the inspected run attempt and rejects duplicate-suppressed runs whose final verification was skipped. Certificate procurement, secret installation and live installer acceptance remain external setup. `npm run package:installer` creates an installer without publication; ordinary CI continues using the unpacked package.

Renderer crashes are recovered silently from durable saves with a two-reload process budget. Local crash dumps and bounded platform facts remain on the device; no crash uploads or telemetry are enabled. Treat crash records as potentially sensitive support artifacts and share only with player consent.

Release acceptance still requires installing and launching the actual Steam depot on clean Windows, checking updates and normal Windows security behavior, live two-device Steam Cloud and account switching, physical-controller disconnect/reconnect, and Deck/Proton overlay, sleep/resume and offline play. Signed installer acceptance applies only if that optional distribution path is used. Automated checks cannot complete these hardware and account-dependent steps.

## Dependency inventory and provenance

Every production build runs `npm run generate:release-inventory` after Vite. The renderer includes `dependencies.cdx.json` (CycloneDX production npm build inputs plus the distributed Electron runtime) and `THIRD-PARTY-NOTICES.txt`. This is an input inventory, not a claim to enumerate every native Chromium component; retain Electron's packaged `LICENSE.electron.txt` and `LICENSES.chromium.html`. Installed production versions must match the lockfile and have nonempty license text. The published react-remove-scroll-bar 2.3.8 package omits its MIT text; its [supplemental license](third-party/react-remove-scroll-bar-LICENSE.txt) is copied from [upstream commit 7301c160](https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE), with the fallback scoped to that exact version. Font and shadcn source notices are included.

Windows CI runs `npm run generate:release-inventory -- --package release/win-unpacked` after package validation to retain hashes of the final executable, archive and Electron license inventories. After the complete verification gate succeeds, trusted main/tag pushes attest the Windows executable and ASAR plus their matching SBOM through a separate job with narrowly scoped OIDC permissions. Branch and pull-request jobs do not obtain attestation-write or OIDC permissions. The Windows artifact retains its original `release/`, `dist/` and `reports/` paths so the attestation consumes the exact same-run files. GitHub provenance records build origin and integrity; it does not supply Windows Authenticode trust or suppress Windows security warnings. Optional signed candidates also inventory the final signed components and attest their installer and SBOM; ordinary CI does not acquire certificate credentials. Installer and Steam acceptance remain separate, and the signed workflow is dispatched only for an explicitly selected release tag.

The [scheduled dependency security workflow](../.github/workflows/security.yml) runs weekly and on manual dispatch, retaining audit details and failing on new advisories or expired exceptions. It uses the same policy as ordinary CI; the existing electron-builder advisory exception is not extended or replaced by a forced downgrade.
