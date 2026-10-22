# Release qualification record

Use this record with [release readiness](RELEASE.md) for each candidate. Copy it into the candidate's retained evidence and fill in actual observations. An unchecked item remains unverified; source tests and browser gamepad simulation do not satisfy native or hardware acceptance. Do not enter credentials, account identifiers, saves or crash dumps in this document.

## Candidate identity

- Version/tag:
- Full source commit:
- Successful full CI URL and attempt for that commit:
- Signed candidate workflow URL:
- Installer SHA-256 from the attested artifact:
- Authenticode signer and verification result:
- Windows version and display scaling:
- Controller models and connection types:
- Steam client version:
- Steam Deck model, SteamOS/Proton version and distribution path:
- Reviewer and observation date:

Retain the immutable signed installer, its matching dependency SBOM and third-party notices, package hash inventory and GitHub attestations. Verify provenance with `gh attestation verify <installer-path> --repo Talyen/Fauna`. An attestation identifies the builder and artifact; it does not establish gameplay or hardware acceptance. The SBOM describes production npm build inputs and the Electron runtime; Electron's packaged Chromium license inventory covers its native third-party components.

## External setup

- [ ] Configure Fauna's own Steam App ID in [Steam configuration](../desktop/steam-config.json); qualify its native binding against that client
- [ ] Configure application-managed Cloud quota for 32 device streams, two slots each, up to 1 MiB per slot; do not also Auto-Cloud those progression paths
- [ ] Configure the protected `release-signing` GitHub environment, trusted dispatch access and Windows certificate secrets described in [candidate signing](RELEASE.md#candidate-signing-and-qualification)
- [ ] Confirm the privacy/support policy for device-local diagnostics; sharing remains player initiated and no uploads are enabled

## Clean Windows and installer acceptance

- [ ] Install the signed candidate on a clean Windows x64 system; verify publisher, shortcuts and ordinary launch
- [ ] Complete a journey, quit through the menu and through the window, then resume the saved checkpoint
- [ ] Install an upgrade over the previous candidate and verify current-format saves and separate device preferences
- [ ] Uninstall; inspect shortcuts and remaining files against the intended save-retention policy
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
- [ ] Disconnect/reconnect during navigation, targeting and a modal; verify reachable focus, no repeated activation and usable prompts
- [ ] On Deck, verify text and target readability on the handheld display, overlay and intended bindings
- [ ] Exercise sleep/resume during battle and while Cloud work is pending, then quit and resume
- [ ] Check cold offline launch, frame pacing, battery use and an extended journey through the intended Proton/native path

## Acceptance

- Outstanding failures or unverified items:
- Evidence references for each completed group:
- Candidate accepted for release by:

Keep incomplete candidates unqualified. This record and the candidate workflow do not upload to Steam, publish a release, procure a certificate or substitute for hardware observations.
