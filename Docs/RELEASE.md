# Release readiness

Fauna targets Windows x64 on Steam, with controller and Steam Deck experience considered from the foundation. The current app runs offline without Steam, game servers, or accounts.

[CI](CI.md) owns automated coverage, exact-commit/build identity, reruns and retained artifacts. Windows produces an unpacked x64 package using electron-builder and `com.fauna.game`, containing only the renderer, desktop code and required runtime dependencies. Automated checks support the candidate qualification below; they do not establish hardware acceptance.

## Shipping requirements

The current path is an **unsigned Windows x64 Steam depot**. Paid signing is deferred; native Linux/macOS packaging is not configured.

| Stage               | Requirement                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup               | Configure Fauna's own App/depot, Cloud quota and App ID in `desktop/steam-config.json`; never use Alchemy's identities or saves. Cloud/overlay adapters exist, but a null App ID disables progress sync; achievements are unimplemented |
| Artifact            | Build/package the final clean tagged commit, retain exact-commit full CI and run the [release identity gate](#release-verification-and-player-notes)                                                                                    |
| Windows             | Qualify the actual Steam depot on clean Windows, including Windows 11 Smart App Control; resolve any launch block                                                                                                                       |
| Controls            | Complete a journey with physical controllers, including disconnect/reconnect and prompts; browser input is standard-mapped Xbox-labeled simulation                                                                                      |
| Deck                | Qualify readability, overlay, sleep/resume, battery/performance and offline startup through the intended Windows/Proton or native path                                                                                                  |
| Content and support | Complete production artwork/audio, source-rights review, store material and privacy/support decisions                                                                                                                                   |

Record setup and actual device results in the [candidate qualification record](RELEASE_QUALIFICATION.md), using the immutable artifact. Publication requires separate authorization.

No release upload, automatic promotion, telemetry or Steam credential handling is configured. External actions follow [AGENTS.md](../AGENTS.md#worktrees-and-integration).

## Packaged integrity

Windows packaging explicitly disables electron-builder publication. The hardening hook configures every Electron 45 fuse, including the Wasm trap handler, and strictly rejects unknown or incomplete fuse wires.

`npm run verify:package -- release/win-unpacked` checks an existing Windows x64 artifact without building, modifying or publishing it. Windows CI runs it between packaging and startup smoke. Set `RELEASE_TAG` to require a matching package version; ordinary package checks need no tag.

| Check          | Required identity or boundary                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native package | PE architecture, Fauna identity/version, Electron runtime files, native Steam module and ASAR paths                                                                              |
| Runtime        | Exact desktop/preload/save-format bytes, sandbox configuration, no renderer development controls; packaged startup ignores `FAUNA_DEV_URL` and never enables development victory |
| Renderer/media | Relative nonempty references, exact bytes matching the existing `dist/` build and validated prepared-media receipts                                                              |
| Hardening      | Actual executable fuse wire and browser-specific V8 snapshot bytes, including disabled Node execution/environment/inspection, required ASAR loading and supported integrity      |

Missing, empty, corrupt, mismatched or escaping resources fail. The runtime inventory follows Electron 45's Windows archive, including `electron_wer.dll`; obsolete ANGLE/DXIL DLL names are not required. The confined `fauna://app/` protocol replaces file-protocol privileges. Structural integrity does not establish Windows startup/resume, signing, installer or Steam delivery acceptance; qualify the exact artifact.

Native performance uses an unpackaged production renderer in isolated profiles. Cold captures measure a new process/profile with ordinary OS caches; they do not replace packaged Windows startup, physical controller, Steam client or Steam Deck review. See [performance scenarios](DEVELOPMENT_TOOLS.md#native-and-reachable-performance-scenarios).

## Steam qualification

Configure application-managed Cloud for Fauna's versioned device-slot namespace: 32 streams, two slots per stream, up to 1 MiB per slot. Do not also Auto-Cloud those progression directories. [Architecture](ARCHITECTURE.md#cloud-reconciliation-and-device-preferences) owns ancestry, preservation, profile separation and offline behavior.

The [live qualification checklist](RELEASE_QUALIFICATION.md#live-steam-and-two-device-cloud) requires actual devices, divergent offline progress, both reconnect orders, preserved alternatives, account switching, disabled Cloud and quit during sync. Verify overlay activation through the client and physical controller, including Deck sleep/resume and custom bindings. Fake-event tests establish lifecycle behavior only; isolated smoke/preview/performance profiles bypass real Steam.

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

Qualify every supported viewport listed in [UI](UI.md#layout-artwork-size-and-spacing) at normal and 125% text, including the largest tooltip setting. Follow its bounded-scrolling rules. Native qualification additionally covers windowed/fullscreen transitions, restored bounds, monitor removal and high DPI. Distinguish renderer CSS dimensions from native frame size and OS scaling; smaller work areas remain unsupported. Exercise permitted reading regions with mouse, keyboard and controller. Browser layout coverage does not establish hardware or packaged acceptance.

## Candidate signing and qualification

Renderer crashes are recovered silently from durable saves with a two-reload process budget. Local crash dumps and bounded platform facts remain on the device; no crash uploads or telemetry are enabled. Treat crash records as potentially sensitive support artifacts and share only with player consent.

Complete the [qualification record](RELEASE_QUALIFICATION.md) for the actual distribution path; signed-installer acceptance applies only if that optional path is used.

### Optional signed installer

Use this path only after an explicit distribution decision, such as direct downloads or unresolved native launch blocks. It is not required for the ordinary Windows CI artifact or unsigned Steam candidate. No certificate, signing environment, paid service or Azure subscription is configured. Steam acceptance does not imply Windows trust; test normal protections using [Microsoft's reputation guidance](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation).

The manually dispatched [signed candidate workflow](../.github/workflows/release-candidate.yml) requires successful full CI for an existing version tag, including the exact commit’s successful final `verify` job, then builds it, signs the executable and NSIS installer, verifies Authenticode and package identity, runs packaged smoke and retains candidate artifacts without publication. Configure `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` in the protected `release-signing` GitHub environment before dispatch; missing secrets fail rather than producing an unsigned candidate. The [CI prerequisite checker](../scripts/release/require-ci.mjs) pins the inspected run attempt and rejects duplicate-suppressed runs whose final verification was skipped. Certificate procurement, secret installation and live installer acceptance remain external setup. `npm run package:installer` creates an installer without publication; ordinary CI continues using the unpacked package.

## Dependency inventory and provenance

Every production build runs `npm run generate:release-inventory` after Vite. The renderer includes `dependencies.cdx.json` (CycloneDX production npm build inputs plus the distributed Electron runtime) and `THIRD-PARTY-NOTICES.txt`. This is an input inventory, not a claim to enumerate every native Chromium component; retain Electron's packaged `LICENSE.electron.txt` and `LICENSES.chromium.html`. Installed production versions must match the lockfile and have nonempty license text. The published react-remove-scroll-bar 2.3.8 package omits its MIT text; its [supplemental license](third-party/react-remove-scroll-bar-LICENSE.txt) is copied from [upstream commit 7301c160](https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE), with the fallback scoped to that exact version. Font and shadcn source notices are included.

Windows CI runs `npm run generate:release-inventory -- --package release/win-unpacked` after package validation to retain hashes of the final executable, archive and Electron license inventories. After the complete verification gate succeeds, trusted main/tag pushes attest the Windows executable and ASAR plus their matching SBOM through a separate job with narrowly scoped OIDC permissions. Branch and pull-request jobs do not obtain attestation-write or OIDC permissions. The Windows artifact retains its original `release/`, `dist/` and `reports/` paths so the attestation consumes the exact same-run files. GitHub provenance records build origin and integrity; it does not supply Windows Authenticode trust or suppress Windows security warnings. Optional signed candidates also inventory the final signed components and attest their installer and SBOM; ordinary CI does not acquire certificate credentials. Installer and Steam acceptance remain separate, and the signed workflow is dispatched only for an explicitly selected release tag.

The [scheduled dependency security workflow](../.github/workflows/security.yml) runs weekly and on manual dispatch, retaining audit details and failing on new advisories or expired exceptions. It uses the same policy as ordinary CI; the existing electron-builder advisory exception is not extended or replaced by a forced downgrade.
