# Release readiness

Fauna targets Windows x64 on Steam and runs offline without Steam, servers or accounts. The current distribution path is an **unsigned Windows x64 Steam depot**; paid signing is deferred and native Linux/macOS packaging is not configured.

[CI](CI.md) owns automated coverage, exact-commit/build identity, reruns and retained artifacts. Automation establishes its recorded checks; browser controller simulation, unpackaged native performance, packaged Windows startup, physical controllers, live Steam and Steam Deck qualification remain distinct evidence. Use the same immutable candidate throughout qualification.

## Shipping requirements

1. **Prepare:** complete [Steam setup](#steam-setup) for Fauna's own application and depot
2. **Build and identify:** use the final clean tagged commit, retain its successful full CI and run the [release identity gate](#release-verification-and-player-notes). Windows uses electron-builder and `com.fauna.game`; the unpacked x64 package contains only the renderer, desktop code and required runtime dependencies
3. **Qualify:** complete the [candidate record](RELEASE_QUALIFICATION.md) on the actual Steam depot, resolving Windows launch blocks and recording physical-controller, Deck, display and live Cloud results. Finish artwork/audio, source-rights review, store material and privacy/support decisions

The candidate record owns the detailed acceptance checklist. Tags, signing/setup, Steam delivery and publication require separate authorization under [AGENTS.md](../AGENTS.md#worktrees-and-integration). No release upload, automatic promotion, telemetry or Steam credential handling is configured; the commands below do not publish.

## Release verification and player notes

For an existing tagged, built and packaged candidate:

```sh
npm run verify:release -- --tag v0.1.0 --package release/win-unpacked
```

The read-only gate requires clean source, an existing tag identifying HEAD, a matching clean renderer receipt and [package integrity](#packaged-integrity). It does not create a tag, bump versions, build, sign or run tests. Change both package manifests for a version bump. Retain and distribute the verified immutable CI artifact; package replacement during verification is outside the gate's scope.

`npm run verify:release-version` checks application identity and package/lock version agreement without building. Optional `--tag v0.1.0` or `RELEASE_TAG` must match exactly. Static and Windows CI run it before validation/build, passing the version tag on tagged pushes; tagged Windows CI also runs the full artifact gate.

Each Vite build records the full commit, Git tree, package version and dirty status, including source changes during the build. Ordinary dirty development builds remain possible; release verification rejects dirty or stale receipts. Packaging compares renderer/media bytes with that matching build, including its receipt. Passing establishes artifact identity and integrity; CI and device acceptance come from their own evidence. [Player-note generation](#player-note-generation) is a separate editorial step.

## Packaged integrity

Windows packaging disables electron-builder publication. Renderer libraries already bundled by Vite are excluded from packaged node modules; Steamworks, Koffi and its target-platform binding remain. Package verification rejects unexpected desktop dependencies, while production build inputs retain license/SBOM coverage. [Resource efficiency](RESOURCE_EFFICIENCY.md#build-and-package-lifetimes) owns size and memory measurements. The hardening hook configures every Electron 45 fuse, including the Wasm trap handler, rejecting unknown or incomplete fuse wires.

```sh
npm run verify:package -- release/win-unpacked
```

This checks an existing artifact without building or modifying it. Windows CI runs it after packaging and before startup smoke. `RELEASE_TAG` optionally requires a matching package version.

| Check          | Required identity or boundary                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native package | PE architecture, Fauna identity/version, Electron runtime files, native Steam module and ASAR paths                                                                                 |
| Runtime        | Exact desktop/preload/save-format bytes, sandbox configuration and no renderer development controls; packaged startup ignores `FAUNA_DEV_URL` and never enables development victory |
| Renderer/media | Relative nonempty references and exact bytes matching `dist/` and validated prepared-media receipts                                                                                 |
| Hardening      | Actual executable fuse wire and browser-specific V8 snapshots; disabled Node execution/environment/inspection, required ASAR loading and supported integrity                        |

Missing, empty, corrupt, mismatched or escaping resources fail. The runtime inventory follows Electron 45's Windows archive, including `electron_wer.dll`, without requiring obsolete ANGLE/DXIL DLL names. The confined `fauna://app/` protocol replaces file-protocol privileges. Startup/resume and distribution acceptance use the candidate record. [Native performance captures](DEVELOPMENT_TOOLS.md#native-and-reachable-performance-scenarios) use isolated unpackaged profiles and ordinary OS caches, not the Windows candidate.

## Vercel web QA

The Vercel project `talyen-s-projects/fauna` connects to `Talyen/Fauna` with Node 24, the Vite preset and `dist` output. [Deployment configuration](../vercel.json) installs pinned npm 12.2.1 and lockfile dependencies and skips the Electron binary download. The [hosted build entrypoint](../scripts/release/vercel-build.mjs) restores Vercel's formatting-only minification of `vercel.json` after comparing exact parsed values, then runs type checks and the ordinary production build. Meaningful configuration edits fail instead of being overwritten; other source edits still mark the build receipt dirty. The launcher recognizes Vercel's hosted `VERCEL=1` environment for these two commands; local execution limits still apply.

Git push deployments are disabled, matching Alchemy's deliberate QA deployment pattern. After the configuration reaches GitHub, deploy a reviewed `main` commit deliberately through Vercel. The project-level Ignored Build Step, `test ! -f vercel.json`, skips source revisions without this configuration. Vercel Authentication protects the default deployment URLs. Do not add a public custom domain without an explicit publication decision.

Content-hashed prepared artwork and audio use a one-year immutable browser cache, reducing repeat downloads. HTML, the prepared manifest and the unversioned startup script retain ordinary revalidation so new deployments can take effect. The site uses static files without Functions, runtime middleware, image optimization or added analytics services. Manual deployments conserve build usage; traffic can still exhaust the Hobby allowance. Check the team's Vercel Usage page before wider testing.

The SPA fallback serves the application entry point for browser navigation. Saves remain in that browser's local storage; desktop Steam Cloud, native controls and packaged Windows behavior require their own qualification. A Vercel build establishes web build evidence, not the complete GitHub CI or native release gate. Release-tag Deploy Hook automation is not configured.

## Steam setup

Partner identity verification and application creation are pending; Fauna has no Store page or assigned App ID yet. After verification, complete this setup for the candidate:

1. Create Fauna's own application, Windows x64 depot and packages. Enter the assigned App ID in [steam-config.json](../desktop/steam-config.json); never reuse another game's identities or saves. A null ID disables Steam integration; full release verification rejects missing, invalid and Spacewar IDs, while ordinary development and version-only checks remain available
2. Configure the depot to launch `Fauna.exe` from the verified unpacked game directory. Upload that immutable game artifact through the authorized delivery process; an NSIS installer belongs only to the optional direct-download path
3. Configure and publish application-managed Cloud for at least 64 files and 64 MiB per user: 32 device streams, two slots each, up to 1 MiB per slot. Keep **Dynamic Cloud Sync disabled** because the adapter does not consume in-session remote-file-change callbacks. Do not also Auto-Cloud progression paths, device preferences, diagnostics or identity metadata
4. Enable intended controller types through Steam Input and publish recommended configurations. Qualify actual hardware and prompts, including emulated Xbox identities
5. Complete the Content Survey, regional ratings, support contact, system requirements, price and release checklist using [Store preparation](STEAM_STORE.md). Confirm the privacy/support policy for device-local diagnostics; sharing remains player initiated without uploads
6. Record actual setup and acceptance evidence in the [candidate record](RELEASE_QUALIFICATION.md), including live overlay, two-device Cloud, physical controllers and Deck. Achievements remain unimplemented

[Architecture](ARCHITECTURE.md#cloud-reconciliation-and-device-preferences) owns Cloud reconciliation, profiles and offline behavior. The main process receives overlay events through Valve's flat manual-dispatch API using Koffi and the bundled Steam library; Cloud uses steamworks.js in a separate utility process. Graphics switches precede Electron readiness. Native export/payload tests and packaged smoke load the real callback binding without initializing Steam; fake events establish lifecycle behavior, while smoke, preview and performance profiles bypass live Steam.

## Display acceptance

Qualify every [supported viewport](UI.md#layout-artwork-size-and-spacing) at normal and 125% text with the largest tooltip setting. Follow bounded-scrolling rules and exercise reading regions with mouse, keyboard and controller. First launch in Big Picture (`SteamTenfoot=1`) defaults to fullscreen; an existing device preference wins. Native checks also cover windowed/fullscreen transitions, restored bounds, monitor removal and high DPI. Renderer CSS size differs from native frame size and OS scaling; smaller work areas remain unsupported. Record results in the candidate checklist.

## Candidate signing and qualification

Complete the [qualification record](RELEASE_QUALIFICATION.md) for the distribution path used. Renderer crashes recover silently from durable saves with a two-reload process budget. Crash dumps and bounded platform facts stay on-device without telemetry/uploads; share these potentially sensitive support artifacts only with player consent.

### Optional signed installer

Use only after an explicit distribution decision, such as direct downloads or unresolved native launch blocks. Signing is not required for ordinary Windows CI or the unsigned Steam candidate. No certificate, signing environment, paid service or Azure subscription is configured. Steam acceptance and GitHub provenance do not supply Windows trust; test normal protections using [Microsoft's reputation guidance](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation).

The manually dispatched [signed candidate workflow](../.github/workflows/release-candidate.yml) requires an existing version tag with successful full CI, including that commit's final `verify` job. The [prerequisite checker](../scripts/release/require-ci.mjs) pins the run attempt and rejects duplicate-suppressed runs with verification skipped. The workflow builds, signs the executable/NSIS installer, verifies Authenticode and package identity, runs packaged smoke and retains artifacts.

Configure `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` in the protected `release-signing` GitHub environment; missing secrets fail instead of producing unsigned candidates. Certificate procurement, secret installation and actual installer acceptance are external setup. `npm run package:installer` creates an installer without publication; ordinary CI retains unpacked packaging and no certificate access.

## Dependency inventory and provenance

Every production build runs `npm run generate:release-inventory` after Vite, producing `dependencies.cdx.json` and `THIRD-PARTY-NOTICES.txt`. The CycloneDX inventory covers production npm build inputs and the distributed Electron runtime, not every native Chromium component; retain Electron's `LICENSE.electron.txt` and `LICENSES.chromium.html`. Installed production versions must match the lockfile and include nonempty license text. Font and shadcn notices are included.

The published react-remove-scroll-bar 2.3.8 package omits its MIT text. Its [supplemental license](third-party/react-remove-scroll-bar-LICENSE.txt) comes from [upstream commit 7301c160](https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE); the fallback applies only to that version.

Koffi 3.3.3 and 3.3.4 platform binary packages omit license text. Their manifests declare MIT, and their matching `koffi` package supplies that text. The inventory uses it only when the installed parent, native package and locked parent versions match and both manifests declare MIT.

After package validation, Windows CI runs `npm run generate:release-inventory -- --package release/win-unpacked` to retain hashes of the final executable, archive and Electron license inventories. Once the complete gate passes, trusted main/tag pushes attest the executable, ASAR and matching SBOM in a separate job with narrowly scoped OIDC permissions. Branch/PR jobs receive neither attestation-write nor OIDC permissions. Artifacts preserve `release/`, `dist/` and `reports/` paths so attestation consumes exact same-run files.

Optional signed candidates inventory final signed components and attest installer/SBOM for the explicitly selected release tag. Provenance establishes build origin/integrity, not Authenticode trust or suppression of Windows warnings; qualify installer and Steam delivery separately.

The [weekly/manual security workflow](../.github/workflows/security.yml) retains audit details and fails on advisories under the [ordinary CI policy](CI.md#pipeline).

## Player-note generation

```sh
npm run generate:patch-notes -- --dry-run
npm run generate:patch-notes
npm run generate:patch-notes -- --tag v0.1.0 --dry-run
```

Without a tag, the range is the nearest reachable release tag through HEAD; a tagged release starts after its nearest preceding reachable release tag. Unrelated tags and tag dates do not affect selection. With no preceding release, all reachable non-merge commits are considered; uncommitted edits are excluded. Drafts go under ignored `reports/release-notes/`; dry-run prints without writing.

| History                                          | Draft treatment                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| Runtime/content `feat`, `balance`, `fix`, `perf` | New, Balance, Fixes and Performance sections; tooling-only commits omitted |
| `Player-Note: <player-facing sentence>` trailer  | Explicit wording and inclusion                                             |
| `User-Facing: yes`                               | Include other commit types under Changes                                   |
| `User-Facing: no`                                | Always exclude                                                             |

Duplicate lines collapse. Review wording before publication; commit subjects are fallback copy, not approval. Linux CI fetches complete history and retains the draft in the seven-day `player-notes` artifact even if later validation fails.
