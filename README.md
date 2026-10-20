# Fauna

A single-player creature-collecting card battler for Steam. Choose a starter and recruit companions, combining their cards in one shared deck. Find combinations, recruit new teammates, and reach the heart of the wilds.

This foundation contains a complete short journey: choose one of five starter species, explore two biomes with three encounters and a boss each, collect keyword XP and currency, recruit reserves, choose journey relics, and unlock Moonhart on victory. The illustrations are original procedural SVG placeholders, not final production artwork.

## Run

Use Node 24 (`.node-version`) and npm 11+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:48209. To use the Electron shell instead:

```sh
npm run dev:desktop
```

Browser and desktop profiles are separate. Desktop saves live in Electron's Fauna user-data directory under `saves/expedition.json`; browser saves use the `fauna.save.v1` localStorage key. Both keep two backups. Development saves are disposable: only the current format is supported, with no migration or backward-compatibility requirement. Use a fresh browser context for experiments instead of deleting player saves.

## Play

Inspect the available creatures, choose one starter, then begin the journey. Every creature contributes three cards. Keep up to five cards in hand and spend up to three mana each turn. Extra draws wait in a hidden, unplayable buffer and fill open hand slots in order as cards are played. End turn discards the hand and buffer. Select a card and an enemy or ally; confirm team guard cards with Play. Enemy actions remain hidden. Block absorbs attacks, and each creature has a passive trait.

Knocked-out creatures cannot act and their cards leave circulation for that battle. Defeat the enemy row to restore the roster and bank XP/currency. The shared Reward screen offers recruitment after ordinary combat or relic choices after intermediate bosses; choosing or skipping advances directly. Choose from the three defeated creatures, including species already owned, to build a five-creature roster. Each copy has its own battle state. Recruits fill the starting lineup up to three creatures, then join the two reserves. The starting lineup is remembered and optionally editable from the menu between battles. Swap freely during combat; incoming cards replace outgoing cards in their current zones without healing, drawing, or spending Mana. Healthy reserves can replace fallen creatures; defeat requires the entire roster to fall. Keyword XP unlocks shared permanent talents; talents can be bought or reset at any time through the menu. Defeating the boss unlocks Moonhart; losing or ending a run preserves discoveries.

- Mouse: select cards and targets. Right-click any card to inspect it.
- Keyboard: W/A/S/D navigate, Enter/Space activate, I inspects a focused card, Escape cancels or opens the menu. Tab remains available.
- Standard controller: D-pad/left stick navigate, south/A confirms, east/B backs out, west/X inspects, north/Y ends the turn. Button mapping follows standard Xbox-style positions. Non-standard mappings are not yet supported.

Gameplay settles before visual feedback. Accepted commands automatically save; a save failure exposes a retry action. Desktop close requests wait for queued saves. Browsers warn about closing while saves are pending, but abrupt browser/process termination cannot guarantee completion of queued writes.

## Verify

The default local workflow is small and bounded:

```sh
npm test                              # Fixed Node smoke, one worker
npm run check -- src/game/engine.ts   # Smoke plus selected-file formatting
npm run check -- --diff               # Dirty tracked and untracked files
npm run check -- --base main          # Committed task diff plus local edits
npm run verify                       # Same local check; defaults to the dirty set
```

Smoke covers atomic turn settlement, save ordering/recovery, and the verification harness. It uses one worker, a 512 MiB Node heap limit, lower process priority when supported and a 30-second deadline. Formatting checks at most 50 existing files, each at most 256,000 bytes, within an 8,000-byte argument budget; larger batches are explicitly deferred to CI. Markdown-only checks skip Node smoke. Use explicit task paths in a mixed checkout. Local integration checks the combined diff against locked main with this same lightweight gate.

CI owns complete validation: full static checks, all unit tests including DOM, one production build, the browser suite, Windows x64 packaging and packaged Electron startup/save/resume/isolation smoke. Linux verification skips the unused Electron download; Windows still installs and packages Electron. Every push and pull request runs the full CI profile. No test suites have been removed.

Focused unit tests remain available during development:

```sh
npm run test:full -- tests/unit/starter.test.ts
```

Broader local checks are explicit opt-ins, not routine handoff steps:

```sh
npm run check:full     # Full static aggregate
npm run test:full      # All unit suites, including DOM
npm run verify:full    # Full static, all units, build and browser journeys
npm run test:desktop   # Native Electron smoke; needs a current build and binary
npm run package:win    # Windows unpacked package
```

Agents run those broader local checks only when requested. Local checks and integration do not establish CI or release readiness. Browser screenshots and traces are written to ignored `reports/` and `test-results/`; desktop smoke requires a desktop session. See [release boundaries](Docs/RELEASE.md) for remaining platform gates.

The Windows job creates an **unpacked x64 application**, not a signed release installer. Code signing, production Steam App IDs, Steamworks services, upload/promotion, physical controller checks, and Steam Deck/Proton testing remain release work. No remote services or account credentials are needed to play.

## Architecture and authoring

- [Architecture and saves](Docs/ARCHITECTURE.md)
- [Content and artwork](Docs/CONTENT.md)
- [UI and typography](Docs/UI.md)
- [Release and verification boundaries](Docs/RELEASE.md)

Alchemy informed the technology choices and architectural patterns. Fauna has its own implementation and no runtime dependency on Alchemy. Mana crystal UI sprites are adapted from Alchemy; provenance is recorded in the battle-layout sample README.
