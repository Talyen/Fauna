# Release qualification record

Use this record with [release readiness](RELEASE.md) for each candidate. Copy it into the candidate's retained evidence and fill in actual observations. An unchecked item remains unverified; source tests and browser gamepad simulation do not satisfy native or hardware acceptance. Do not enter credentials, account identifiers, saves or crash dumps in this document.

## Candidate identity

- Version/tag:
- Full source commit:
- Successful full CI URL and attempt for that commit:
- Distribution/signing policy: unsigned Windows Steam candidate; paid signing deferred
- Windows artifact and provenance URLs:
- Executable and ASAR SHA-256 from the attested artifact:
- Authenticode signer and verification result: not applicable to the unsigned Steam candidate
- Windows version and display scaling:
- Controller models and connection types:
- Steam client version:
- Steam Deck model, SteamOS/Proton version and distribution path:
- Reviewer and observation date:

Retain the immutable Windows candidate, its matching dependency SBOM and third-party notices, package hash inventory and GitHub attestations. Verify provenance with `gh attestation verify <executable-or-asar-path> --repo Talyen/Fauna`. GitHub provenance is separate from Windows Authenticode signing and does not make an unsigned executable trusted by Windows. An attestation identifies the builder and artifact; it does not establish gameplay or hardware acceptance. The SBOM describes production npm build inputs and the Electron runtime; Electron's packaged Chromium license inventory covers its native third-party components.

## External setup

- [ ] Complete the [Steam setup procedure](RELEASE.md#steam-setup) and retain configuration/publication evidence:
- [ ] Record the completed content survey and Store review from [Store preparation](STEAM_STORE.md):
- [ ] Record the confirmed privacy/support policy and consent process for local diagnostics:
- Optional signed installer setup/evidence, only for the selected distribution path: [signing procedure](RELEASE.md#candidate-signing-and-qualification)

## Clean Windows and Steam acceptance

- [ ] Install the actual Steam depot on clean Windows x64 systems and verify ordinary launch without administrator privileges
- [ ] On clean Windows 11 with Smart App Control enabled, verify launch with normal Defender/antivirus protection; retain any warning or blocking evidence and resolve it before qualification
- [ ] Complete a journey, quit through the menu and through the window, then resume the saved checkpoint
- [ ] Apply a Steam update over the previous candidate and verify current-format saves and separate device preferences
- [ ] Uninstall through Steam; inspect remaining files against the intended save-retention policy
- Optional direct-download installer acceptance: if that path is used, separately verify Authenticode, install/upgrade/uninstall and launch shortcuts
- [ ] Check minimum renderer size, high DPI, 125% text, fullscreen/windowed switching, display removal and restored bounds
- [ ] Exercise crash recovery and confirm durable progress resumes without recovery UI; collect local diagnostics only with consent

## Live Steam and two-device Cloud

- [ ] Launch through the intended Steam App/depot; confirm overlay activation pauses play and closing it requires ordinary resume
- [ ] Save on device A, quit normally, then launch on B and verify the same progression
- [ ] Play divergent journeys offline on both devices; reconnect in both orders and verify automatic resolution and preservation of competing heads
- [ ] Disable Cloud, reconnect after failed reads/uploads and quit during pending sync; verify local progress remains playable
- [ ] Switch Steam accounts; verify separate local profiles and no cross-account uploads
- [ ] Launch without the Steam client; verify the intended local profile resumes offline

## Physical controls and Steam Deck

- [ ] Complete battle, targeting, swaps, rewards, settings, inspection and pause flows with each intended physical controller
- [ ] Disconnect/reconnect during navigation, targeting and a modal; active-controller disconnection stops autoplay and opens pause without automatic resume; verify reachable focus, no repeated activation and usable prompts
- [ ] Check Automatic and manual Xbox/Deck, PlayStation and Nintendo prompts, including Steam Input emulation; publish a recommended configuration for each supported controller family
- [ ] On Deck, verify text and target readability on the handheld display, overlay and intended bindings
- [ ] Exercise sleep/resume during battle and while Cloud work is pending, then quit and resume
- [ ] Check cold offline launch, frame pacing, battery use and an extended journey through the intended Proton/native path

## Acceptance

- Outstanding failures or unverified items:
- Evidence references for each completed group:
- Candidate accepted for release by:

Keep incomplete candidates unqualified. This record and the candidate workflow do not upload to Steam, publish a release, procure a certificate or substitute for hardware observations.
