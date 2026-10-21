# Alchemy tools and platform adoption plan

Add stronger architecture checks and unused-code detection, hardened Electron packages, optional non-combat encounters, desktop display modes, Steam Cloud saves, and Steam overlay pause. Adapt Alchemy's patterns to Fauna's existing game, application, and platform owners. Fauna retains independent code, content selection, application identity, and saves.

The implementation follows the selected scope and defaults below. Local focused checks accompany delivery; full CI, rendered/native package and live Steam acceptance remain separate evidence gates. Steam partner configuration, credentials, uploads and publication require separate authorization. Repository references were checked against Fauna `b0f87b4` and Alchemy `7790d47fb`; implementation must re-read current contracts before editing.

## Scope and delivery order

| Stage | Deliverable                                           | Depends on                                             |
| ----- | ----------------------------------------------------- | ------------------------------------------------------ |
| 1     | Parser-based architecture checks and Knip             | Existing static CI gate                                |
| 2     | Electron fuse configuration and package verification  | Existing packaging and startup smoke                   |
| 3     | Desktop display preferences                           | Existing Settings and authorized preload IPC           |
| 4     | Merchant and event gameplay with current-format saves | Content, commands, reward and journey contracts        |
| 5     | Merchant and event presentation and replay coverage   | Stage 4                                                |
| 6     | Optional Steam runtime and overlay pause              | Platform lifecycle and test isolation                  |
| 7     | Cloud protocol, local metadata and reconciliation     | Stage 6 and finalized Stage 4 save contract            |
| 8     | Cloud recovery UI and platform qualification          | Stage 7; Fauna Steam configuration for live acceptance |

Stages 1 through 3 can be implemented independently. Complete the encounter save changes before establishing cloud fixtures, avoiding two competing definitions of the current payload. Keep each stage reviewable and locally integrated through the protected workflow. No stage requires discovering, polling, or coordinating other chats.

Excluded: Homestead, additional currencies, permanent upgrade purchases, Gear, crafting, difficulty tiers, localization, achievements, rich presence, demo editions, detailed result inspection, mutation testing, balance sweeps, memory soaks, telemetry, and automatic release delivery. Existing controls, fixed artwork dimensions, free swaps, hidden enemy intentions, and application-owned saving remain authoritative.

## Architecture checks and unused code

Replace the source-pattern import checks in `scripts/boundaries.mjs` with parser-backed checks. Prefer configured Oxlint rules for syntax and restricted globals/imports; use a resolved dependency graph only for boundaries those rules cannot establish. Evaluate Alchemy's Oxlint rules and dependency-cruiser configuration, but do not import its feature hierarchy, barrel requirements, or session-singleton exceptions. Use one authoritative Fauna rule definition rather than separate inconsistent lists.

Enforce these existing contracts:

- `src/game/` imports only other gameplay modules, Immer, and Zod. Resolve relative paths and aliases before testing directory membership. Check imports, re-exports, literal dynamic imports, and CommonJS references where supported. Reject unresolved computed module access in gameplay rather than assuming it is safe.
- Gameplay cannot use browser, filesystem, network, Steam, clock, timer, or ambient randomness APIs. Recognize syntax and bindings so comments, strings, and unrelated property names do not produce false positives. Explicit state/RNG inputs remain allowed.
- Application code may consume gameplay and platform contracts, but never React, UI modules, or desktop implementations. Platform code never imports UI or gameplay resolvers; validating transported save bytes uses an explicitly reviewed boundary rather than moving gameplay into Electron.
- UI consumes session commands and committed views. It cannot write progression storage, import desktop modules, or grant rewards directly. Preferences and diagnostic persistence retain their existing platform capabilities. Legitimate pure UI previews remain allowed.
- Desktop Node code stays behind the preload bridge. Renderer code cannot obtain Node or Steam clients, arbitrary IPC, filesystem paths, or privileged object handles.

Add Knip with explicit production, desktop, tooling, test, Vite, and Playwright entrypoints. Include dynamically loaded harness workers and generated asset lookup consumers. Exclude ignored reports and generated outputs by their established ownership. Remove small confirmed dead exports/dependencies within this scope; report substantial independent findings. Never auto-delete files or accept a large unexplained ignore list. Each necessary exception names its actual consumer.

Run comprehensive architecture and dead-code checks in CI through `check:full` or its canonical successor, once per verification run. Keep the bounded local handoff gate unchanged. New packages must have a concrete role: Knip finds unused code; dependency-cruiser is justified only if resolved graph rules need it. A custom parser should not duplicate an existing supported lint capability.

Acceptance: fixtures prove forbidden imports through alternate path spellings, re-exports, dynamic imports and globals fail; allowed gameplay, type imports and quoted text pass. The full repository has no unexplained violations. Knip reports real unused entrypoints without classifying live harnesses or native runtime dependencies as removable. Existing UI source-policy enforcement remains intact.

References: `Alchemy: lint/boundaries.js`, `Alchemy: lint/restricted-global-references.js`, `Alchemy: lint/session-ownership.js`, `Alchemy: dependency-cruiser.config.mjs`, and `Alchemy: knip.config.js`.

## Electron package hardening

Add a Fauna-owned after-pack hook using `@electron/fuses`. Disable RunAsNode, NODE_OPTIONS, and Node CLI inspection; require application loading from ASAR and enable supported ASAR integrity validation. Evaluate the remaining Alchemy settings, including cookie encryption and file-protocol privileges, against Fauna's actual `file:` renderer, preload, media and storage behavior. Implementation retains file-protocol privileges for Fauna's existing trusted local renderer. Apply only settings supported and verified for the pinned Electron runtime and target platform; document platform limitations rather than promising integrity enforcement everywhere.

If enabling a browser-process-specific V8 snapshot, install the corresponding snapshot beside every required runtime snapshot before setting its fuse. Adopt the snapshot preparation and fuse changes as one tested unit. Do not copy Alchemy's application name, paths, signing identity, or Steam metadata. Apply fuse changes before signing; preserve platform signing requirements and document that signing setup remains separate.

Extend `scripts/verify-package.mjs` to read actual executable fuse values, verify required snapshot files and their expected relationship to the pinned runtime, check the native Steam module layout when introduced, and retain current archive/source/media identity checks. Verify required files inside and outside ASAR according to their packaging contract. Native modules must remain loadable with the selected ASAR and fuse policy.

Windows CI must package once, verify the actual unpacked artifact, then exercise launch, gameplay save/resume, backup recovery and graceful close. Check that production ignores development URLs and prohibited environment overrides without launching external commands. Include a failed-fuse or missing-snapshot fixture to prove the package gate rejects it. A structural check cannot replace startup smoke.

Acceptance: incorrect fuse values and missing required snapshots fail verification; the hardened Windows artifact starts and saves; optional Steam failure still permits offline play. Browser builds retain their existing behavior. Installer signing, installer acceptance and Steam distribution stay separate release gates.

Reference: `Alchemy: desktop/after-pack.cjs` and its package-layout tests. See [current packaged integrity](RELEASE.md#packaged-integrity).

## Desktop display modes

Add Windowed and Fullscreen to Settings under Display using a registered shadcn RadioGroup. Offer the setting only when the platform exposes the capability. Fullscreen means the platform-supported borderless fullscreen experience; exclusive display-mode switching and resolution selection are out of scope. Default to Windowed on a new profile.

The desktop process owns persisted mode, last usable window bounds, and actual window state. Keep these device preferences outside progression and cloud payloads. Extend the typed preload with validated get/set operations and actual-state notifications; accept only known modes from the authorized main frame. Renderer code cannot pass window options or arbitrary geometry. Settings displays the confirmed mode and handles a rejected or failed transition with a concise error.

Apply the saved mode at ordinary launch. Restore windowed bounds clamped to a currently available display, with a reachable title bar after monitor removal or resolution changes. Remember resize/move changes without unbounded disk writes. Native fullscreen exit updates the setting; serialize rapid requests and ignore late completion from superseded requests. Preserve input focus and avoid forwarding the same key press into gameplay during a transition. Quit drains preference writes without entering the progression save lane.

Use native Electron window APIs rather than injected renderer JavaScript for fullscreen. macOS may need a platform-specific implementation; its behavior must be verified independently from Windows. Automated preview, smoke and performance profiles use explicit isolated geometry and never alter the player's settings or unexpectedly fullscreen a test window.

Artwork remains at the fixed dimensions in `src/ui/tokens.css`; changing mode repositions, wraps or scrolls content. It never scales artwork, controls or text to fit. Settings focus, text/tooltip size, reduced motion and controller navigation continue to work.

Acceptance: mode applies live and after restart; returning to Windowed restores reachable bounds; invalid requests fail; unavailable monitors and failed preference writes leave a usable window. Browser omits the control. Tests cover isolated profiles and rapid changes; rendered/native review covers both modes and large text.

Reference: `Alchemy: desktop/main.cjs` display-mode handling. Adapt ownership and persistence without copying its renderer fullscreen injection or game-size scaling.

## Optional non-combat encounters

Preserve the eight-encounter journey, bosses at encounters 4 and 8, ordinary recruitment, intermediate-boss Boons, and Campfire recovery. Biomes and pre-battle enemy previews are removed. Offer an optional Merchant before encounters 2 and 6:

| Visit    | Availability                                                                          | Initial content                                                                  |
| -------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Merchant | Beside combat destinations before encounters 2 and 6, only when an item is affordable | Two distinct unowned journey Boons, 20 Gold each; at most one purchase per visit |

Prices and effect amounts are initial tuning, owned by authored content rather than UI literals. A new account can spend the first 20-Gold victory payout at the first Merchant. The price intentionally spends permanent savings on a journey-only benefit; show the wallet, price and journey duration clearly. Do not add another currency or imply the purchase unlocks the Boon permanently.

These visits do not replace or advance combat encounters. Continuing to the next battle forfeits that support opportunity. Entering a visit commits its saved state; leaving consumes it even without a purchase. Inspecting location artwork and canceling before entry consumes nothing. Returning from a completed visit preserves the exact enemy pack. The next scheduled Merchant offer creates fresh visit availability; saving/reloading never refreshes it.

Merchant stock is drawn once from eligible unowned Boons when the support offer is generated, using explicit gameplay RNG. Persist stock, stable slot IDs, authored prices and visit identity. Offer up to two eligible Boons; omit the Merchant if none remain. There are no restocks, selling, buyback, card removal, permanent unlocks or recruitment purchases. After buying one, show the committed owned state and Leave; do not add a redundant success screen.

Purchase commands carry visit and slot identity, never a client-selected price or effect. Validate phase, active visit, affordability, current stock, duplicate ownership and purchase limit before mutation or RNG. Debit currency and add the Boon atomically, publish one committed result, and enqueue one save through the session. Repeated/stale commands retain state and RNG. Inspecting stock remains read-only.

Campfire appears beside destination choices whenever any roster creature, including a reserve or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns to the same combat offers without advancing the encounter or changing RNG. It remains available while the threshold is met. Sheltered Springs are removed; Campfire is the recovery destination. Campfire preserves existing Merchant stock and receipts.

### Rewards and save invariants

Merchant ownership can reduce the intermediate boss's eligible Boon pool below three. Change boss choices to offer `min(3, eligible unowned Boons)`, including valid one- and two-choice rewards. If none remain, advance directly. Never duplicate owned Boons or silently discard a nonempty reward pool to retain the old three-choice assumption.

Journey currency records gross retained earnings, not the current wallet or net profit. A purchase reduces the wallet without reducing journey earnings. Gold is the player-facing name for this permanent currency. Existing validation currently compares journey earnings against the wallet, which becomes invalid with spending. Update that invariant and its consumers together; keep journey totals bounded and coherent without inferring them from wallet differences. Results remain earnings-only and do not gain spending statistics.

Add typed support-offer and active-visit state to the gameplay aggregate, with explicit availability, visited/resolved identity, saved stock and choice status. Validate phase/route coherence, authored IDs, unique stock, price bounds and purchase receipts. Keep price changes from rewriting an already saved current-format offer. Bump the disposable development save format once for the combined encounter change and update fixtures; reject obsolete saves without migrations. Finalize this contract before cloud protocol fixtures.

### Presentation and automation

Reuse destination ArtCards, inspection, registered dialogs/buttons, roster recovery readouts and owned-Boon inspection. Merchant and Campfire use 4:3 location artwork; Boons retain 3:4 artwork. Include selected source provenance and prepared receipts, or clearly identified existing placeholders until final art is approved. Do not generate or copy additional media outside the existing asset workflow.

Inspection offers Enter; the committed visit displays its choices and Leave. Escape backs out of nested inspection before leaving a visit. Leaving has no confirmation because it destroys no owned reward. Main/pause menus preserve the current visit. Wallet and prices remain readable at 125% text; keyboard/controller focus survives a purchase, a disabled choice, and returning to destinations. Auto-play never enters visits or spends currency.

Extend the production headless policy with explicit deterministic support decisions. The initial heuristic buys the first stable eligible Merchant slot when affordable and rests at Campfire whenever the health threshold is met; record this policy so balance results cannot masquerade as human preferences. Add save/resume and replay checkpoints before entry, after purchase/rest, and after leaving. Update existing route and seeded-interaction owners rather than introducing a second encounter driver.

Acceptance: Merchant occurs at most once per scheduled offer; Campfire follows the roster Health threshold; all eight battles and normal rewards remain reachable; support inspection never rerolls combat; rejected purchases preserve state/RNG; save/resume cannot duplicate benefits or spending; starting a new journey drops bought Boons and retains currency. Cover low funds, full Health, cap boundaries, one/no eligible Boons, abandonment and all visit resume phases.

References: `Alchemy: src/features/alchemy/run-loop/shop/shop-transactions.ts`, `Alchemy: src/features/alchemy/run-loop/shop/trinket-shop-commands.ts`, and `Alchemy: src/lib/mystery/types.ts`. This scope supersedes only the previously unselected support-location and currency-spending portions of [journey design](EXPEDITION_DESIGN.md); update that canonical document during implementation.

## Steam runtime and overlay pause

Introduce an optional desktop Steam adapter using a pinned, Electron-compatible native binding. Alchemy uses `steamworks.js`; verify the exact installed package's API, callback availability and native binary before committing to it. Its checked-in declarations and runtime callback usage differ in places, so copied types alone are insufficient evidence.

Use Fauna's own configured App ID, cloud namespace and package metadata. Never ship Alchemy's IDs or a borrowed test App ID. Production ignores development environment overrides. Initialization is optional: absent Steam, disabled Cloud, offline startup or binding failure leave local play available and produce bounded diagnostics. Browser builds do not import the native module. Package the required native files outside ASAR and verify their presence and ABI through the artifact gate and native smoke.

Previews and automated tests must explicitly disable real Steam initialization, account access and cloud calls. Inject fake capabilities through test composition. No automated journey may read, overwrite or upload the signed-in player's actual Steam files. Add the isolation rule to all native test launchers, not just one smoke command.

On overlay activation, send a semantic external-pause event through the authorized bridge. The UI opens the existing pause menu for active play, preserves any higher-priority modal, cancels targeting and pending Auto-play work, suppresses held input until release, and pauses presentation/audio according to existing pause behavior. Repeated activation is idempotent. Overlay closure does not automatically dismiss menus or resume Auto-play; the player resumes deliberately. An already accepted command and its save complete normally.

Track active overlay state independently of window focus so controller input and pending automation cannot resume while the overlay remains open. If activation arrives before renderer subscription, deliver the current active state on subscription. Renderer replacement, disposal and app exit remove listeners and disconnect callbacks. Missing callback support is reported as unavailable; keyboard shortcuts alone are not proof that custom bindings or Steam Deck overlay paths work.

Acceptance: fake events cover activation during a card choice, inspection, shop purchase, save failure and main menu; late callbacks cannot revive disposed UI or command admission. Verify the actual Steam overlay and physical controller behavior separately after configuration.

Reference: `Alchemy: desktop/steam-overlay.cjs` and Steam initialization in `Alchemy: desktop/main.cjs`.

## Cloud save protocol and ownership

Sync one complete progression snapshot, including the unfinished journey, discoveries, currency, talents and receipts. Do not merge wallets, XP, discoveries, rewards or active journeys field by field. Exclude audio/display preferences, diagnostics, preview identity and local development capabilities. Browser saves remain local; no web login or custom server is introduced.

The application owns reconciliation and production save decoding. Desktop owns authenticated Steam transport, account identity, file names, byte limits and serialized native operations. Preload exposes only typed capabilities; renderer input cannot choose arbitrary paths or account IDs. Replace the current placeholder Cloud port with the explicit read/write/list and lifecycle results the protocol needs. Treat native success/failure return values accurately and independently from Promise shape.

### Snapshot format and account separation

Use a separately versioned cloud envelope containing the exact current gameplay payload, payload hash, profile identity, local device identity, monotonically increasing per-device sequence, causal parent identifiers and bounded ancestry/explicit conflict-resolution receipts. Validate the payload through `decodeSave` before installation. Envelope transport metadata does not become a gameplay command, alter gameplay RNG, or change the gameplay revision.

Generate device/profile identities outside gameplay using platform randomness. Keep device identity local to the installation. Bind Steam profiles to the active Steam account, with separate local directories. Preserve the existing standalone/offline profile. On the first Steam launch with nonempty standalone progress, offer Use this progress or Start a separate Steam profile; copy only on explicit choice and retain the standalone original. Never automatically attach another account's progress or cloud files. A running session pins its account; account change stops cloud admission and requires a safe restart/reconciliation.

Do not rely on wall-clock timestamps, wallet totals or numeric gameplay revision to determine which branch is newer. Hash canonical payload bytes; use causal snapshot identity for ancestry. Distinct envelope IDs with identical payloads can be treated as equivalent after validation. Bound payload, metadata, file count and total read bytes; oversized/unrecognized objects remain untouched and produce actionable diagnostics.

### Remote layout and concurrent devices

Avoid a single shared last-writer-wins file. Maintain two alternating snapshot slots per device in a Fauna-specific, versioned namespace. Each complete file contains its own envelope and payload; no separately updated manifest is required to interpret it. Discover files through the binding's cloud file inventory and accept only strict owned names and matching metadata. For each device, select its highest valid sequence and retain the other slot as recovery evidence. Never use sequence values to order different devices.

Each upload writes only the current device's older slot, verifies transport success and, where supported, readback/hash agreement, then records the acknowledgement durably. One device cannot overwrite another device's fork. A partial/corrupt write leaves the other slot available. Prune neither another device's files nor unknown files automatically. Bound the initial protocol to 32 device streams, two slots each, a 1 MiB file limit and a 64-entry ancestry window; validate these provisional limits against the actual encoded save size and Fauna's configured Steam quota before enabling sync. Exceeding a limit stops sync with local play preserved rather than deleting remote data. Do not create a new remote device identity on every launch or preview.

Bounded ancestry may make a very old common ancestor unprovable; treat that case as a conflict. A conflict resolution records the exact competing head identities as resolved, without combining their gameplay values. New descendants of an unchosen branch cause a new conflict. Losing payloads remain in local recovery storage before resolution is published. Concurrent publications remain separate device heads and are reconciled on the next inventory; never claim remote compare-and-swap or cross-device locking that Steam does not provide.

### Reconciliation behavior

| Valid candidates                       | Behavior                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| No local or remote progress            | Create a fresh profile only after reads succeed or the player explicitly chooses offline play     |
| Local only                             | Persist a recoverable local envelope, then upload when the remote inventory is known              |
| Cloud only                             | Install through the local serialized save/backup lane, then expose Continue                       |
| Equivalent payloads                    | Retain progress and reconcile metadata without replaying events                                   |
| One proven descendant                  | Select it, preserve the previous local candidate, and install locally before commands are enabled |
| Divergent or unprovable heads          | Pause command admission and present an explicit conflict choice                                   |
| Invalid primary and valid backup       | Recover the valid current-format candidate; retain the invalid evidence                           |
| Cloud unavailable, denied or timed out | Offer local/offline continuation with sync pending; do not treat failed reads as an empty cloud   |
| Local read/write failure               | Retain the existing actionable Retry flow; never upload a fresh placeholder over unknown progress |

At launch, reconcile before enabling progression commands. Use a five-second application-level wait before offering offline continuation; a late native result cannot install progress after the player has started playing. At runtime, only compare or report conflicts; replacing live progression requires an explicit synchronization transition that freezes commands, drains admitted local writes and revalidates the selected snapshot. Reconnect never silently rolls back an active journey.

Conflict UI shows concise local/cloud summaries: device label, journey phase/encounter, currency and available progress context. Timestamps are informational. Provide Use this save for each candidate, inspectable details when needed, and Play offline without replacement. Do not label a save Better based on wealth or wins. Preserve every competing validated candidate durably before enabling a replacement action. Failure to preserve or install leaves the conflict unresolved. Use registered modal controls and focus ownership; routine successful sync adds no modal or toast.

### Local saves, upload queue and shutdown

Local saving remains authoritative for continued offline play. After each accepted command, serialize the current payload and durable cloud metadata in the local save lane. Only a successful local commit can enqueue its cloud snapshot. Coalesce pending uploads to the latest admitted snapshot per pinned account/profile, preserving causal metadata and continuing after individual failures. Never hold the local save lane while awaiting network/native transport. A metadata write failure leaves the local gameplay save recoverable and prevents an untracked upload.

Expose local save status and cloud sync status separately. Cloud states include Unavailable, Syncing, Synced, Pending and Conflict. Settings shows concise status and Retry where actionable. Local save success remains truthful when cloud sync fails; repeated failures are bounded diagnostics. The internal collector never captures full saves or account identifiers; there is no player-facing diagnostic export.

Shutdown first revokes commands and drains local writes using the existing close handshake. Attempt the newest cloud upload for at most two seconds, then retain its durable pending state and permit quit if local saving succeeded. Local save failure still prevents ordinary quit for Retry. Do not assume a JavaScript timeout cancels an in-flight native call: verify the binding's blocking behavior and isolate potentially unbounded transport from the main/UI process if needed. Do not add a second callback pump when the binding already owns one. Renderer replacement cannot create competing upload queues, and disposed listeners cannot publish status into a new session.

Acceptance: two devices progressing offline produce a conflict without overwriting either head; equal payloads do not conflict; known descendants fast-forward; invalid remote bytes never enter gameplay; local backup recovery still works; repeated retries do not duplicate rewards; cloud outages do not prevent locally saved play or graceful quit. Cover account changes, disabled Cloud, partial writes, quota/file limits, stale asynchronous reads, concurrent publications, ancestry-window exhaustion and interrupted conflict resolution. Test source payloads against the production current-format decoder.

References: `Alchemy: desktop/steam-cloud-storage.cjs`, `Alchemy: src/lib/cloud-save-mirror.ts`, and cloud persistence tests. Fauna's separate device streams are an intentional adaptation to avoid silently overwriting divergent journeys; do not copy Alchemy's reconciliation policy without checking it against this contract.

## Verification and delivery

Use a task branch and isolated worktree for each implementation chat. Inspect status/diffs, commit only task-owned files, incorporate current main, and integrate through `scripts/integrate.mjs` under its shared lock. Preserve dirty main and unrelated work. Changes to dependencies require a worktree-local installation rather than installing through the shared dependency link.

For each stage, review the final combined diff and run `npm run check -- <task-owned paths>`, plus `npm run docs:check` for Markdown. Run focused regression suites where they protect the contracts described above. Keep full static checks, Knip, all units, builds, browser/native journeys, packaging and comprehensive artifact checks CI-owned unless the user explicitly requests local execution. Do not run a browser or build merely because this plan adds one to acceptance coverage.

Update canonical architecture, release, journey, UI, content and development-tool documentation when each behavior ships. Keep the existing adoption plan as the record of earlier work and link this continuation rather than rewriting completed scope as pending. Update headless tools, current save fixtures, browser routes, package integrity and CI together with their changed owners.

Required evidence:

| Area                  | Evidence before declaring implementation verified                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Architecture and Knip | Positive/negative policy fixtures and the actual full CI static result                                                              |
| Hardening             | Fuse inspection, snapshot/native-module checks and startup/save/resume on the exact Windows package                                 |
| Display               | Focused lifecycle tests, rendered Settings review, actual window transitions and restart/bounds restoration                         |
| Encounters            | Command/save/replay tests and a complete journey retaining eight battles, recruitment, boss rewards and support visits              |
| Cloud                 | Fault-injected application/transport tests plus two-device Steam sync, offline divergence, explicit conflict resolution and restart |
| Overlay               | Simulated pause lifecycle plus actual Steam overlay/controller activation and deliberate resume                                     |

Rendered review covers 1280×800 and 1920×1080, 125% text and tooltip sizes, reduced motion, keyboard and simulated controller, full/empty Merchant stock, unaffordable prices, Campfire thresholds, save errors and cloud conflicts. Inspect CI screenshots or an explicitly requested local preview. Passing source or geometry checks alone does not establish visual acceptance.

Physical controller, Steam client, Windows installer/signing, and Steam Deck/Proton qualification remain separate. Deck coverage includes overlay, sleep/resume, offline launch, reconnect, handheld readability and display restoration. Browser simulation and macOS Electron do not establish those results.

## External setup and release blockers

Implementation can proceed with fake Steam capabilities and offline defaults. Enabling real Steam Cloud and live overlay qualification requires Fauna's own App ID, configured Cloud quotas/platform support, correct native binary packaging and access to the intended Steam application. If those are unavailable, deliver the adapter and tests with real sync unavailable; report the exact live acceptance gates still blocked. Never fill the gap with another game's identity.

Remote Steam partner changes, credentials, pushes, PRs, uploads, signing enrollment and publication require separate authorization. Do not enable both Steam Auto-Cloud filesystem synchronization and this application-managed remote namespace over the same profile; choose and document one owner. Cloud account separation does not introduce a custom authentication service.

At handoff report the integrated commit, features delivered, focused/local checks, observed CI evidence, remaining tuning or asset choices, and each platform gate actually exercised. Stop after the requested stage; neither this plan nor a successful package authorizes remote publication.
