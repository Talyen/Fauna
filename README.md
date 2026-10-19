# Fauna

A single-player creature-collecting card battler for Steam. Three companions bring their cards to one shared deck. Find combinations, recruit new teammates, and reach the heart of the wilds.

This foundation contains a complete short expedition: draft three of five species, fight two encounters and a boss, recruit or upgrade between battles, and unlock Moonhart on victory. The illustrations are original procedural SVG placeholders, not final production artwork.

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

Browser and desktop profiles are separate. Desktop saves live in Electron's Fauna user-data directory under `saves/expedition.json`; browser saves use the `fauna.save.v1` localStorage key. Both keep two backups. Use a fresh browser context for experiments instead of deleting player saves.

## Play

Choose three creatures, then start the run. Every creature contributes three cards. Draw five and spend up to three energy each turn. Select a card and an enemy or ally; team guard cards act immediately. Enemy intents reveal their next attack and target. Marks amplify the next hit, block absorbs attacks, and each creature has a passive trait.

Knocked-out creatures cannot act and their cards leave circulation for that battle. Defeat the enemy row to restore the team and choose one reward. Recruitment replaces a creature and its cards, including upgrades. Strengthening a card adds two to its effect, up to three upgrades. Defeating the boss unlocks Moonhart; losing or ending a run preserves discoveries.

- Mouse: select cards and targets. Right-click any card to inspect it.
- Keyboard: arrows navigate, Enter/Space activate, I inspects a focused card, Escape cancels or opens the menu. Tab remains available.
- Standard controller: D-pad/left stick navigate, south/A confirms, east/B backs out, west/X inspects, north/Y ends the turn. Button mapping follows standard Xbox-style positions. Non-standard mappings are not yet supported.

Gameplay settles before visual feedback. Accepted commands automatically save; a save failure exposes a retry action. Desktop close requests wait for queued saves. Browsers warn about closing while saves are pending, but abrupt browser/process termination cannot guarantee completion of queued writes.

## Verify

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:desktop
```

`npm run verify` combines static checks, unit tests, the production build, and browser journeys. Desktop smoke requires a desktop session and a current build. Browser screenshots are written to ignored `reports/`. CI also builds Windows x64 and runs startup, draft, save, relaunch/resume, and renderer-isolation checks against the unpacked executable.

```sh
npm run package:win
```

The Windows job creates an **unpacked x64 application**, not a signed release installer. Code signing, production Steam App IDs, Steamworks services, upload/promotion, physical controller checks, and Steam Deck/Proton testing remain release work. No remote services or account credentials are needed to play.

## Architecture and authoring

- [Architecture and saves](Docs/ARCHITECTURE.md)
- [Content and artwork](Docs/CONTENT.md)
- [UI and typography](Docs/UI.md)
- [Release and verification boundaries](Docs/RELEASE.md)

Alchemy informed the technology choices and architectural patterns. Fauna has its own implementation and no dependency on Alchemy or its assets.
