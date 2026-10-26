# Passive Boon implementation

Implemented Rainkeeper, Dream Yo-Yo, Basalt Glass Bookmark, Wonder Domino, Furnace Prism, Last Threshold, Camp Hammock, Honeycomb Frame, Undertow Castanets and Orbit Armillary. The [content contracts](../content/boons.md#execution-contracts) record exact execution details; the [Boon rules](../../src/game/rules/boons.ts) own displayed copy. Last Threshold uses the approved wording “Overflow Healing is shared with allies at Death's Door”. The Boon design skill retains this wording and the glossary and passive-design principles.

Block now preserves hit mechanics by default, including both Thorns pools, Leech and buildup. Health-loss conditions still use Health actually lost. Overflow Healing is allocated once without applying Healing bonuses twice. Automatic Healing can include living backups without making them selectable or activating their passives. Rainkeeper reuses the existing Mana crystals, including a second row for seven or eight Mana; no battle controls were added.

## Local evidence

- `tests/unit/game/boons.test.ts`: 29 tests passed, including accepted plays, detached previews, same-card ownership, finite overkill and Healing, source attribution, control immunity, status protection, backup eligibility and save validation
- `tests/unit/game/combat-reactions.test.ts`: 45 tests passed for the foundational Block change before the ten Boons were added
- `tests/unit/ui/keywords.test.tsx`: 5 tests passed; Healing and Critical Hits use canonical keyword identities alongside natural inflections
- `tests/unit/ui/ui-motion.test.tsx -t 'shows overflow Mana'`: the focused overflow display/spending regression passed
- `tests/unit/game/modifier-contracts.test.ts`: 341 tests passed after the intentional feature baseline update
- Eight targeted ability replay cases and four targeted combined-combat replay cases passed after their intentional baseline updates
- The lightweight task gate passed formatting, syntax lint, source ownership/boundary contracts and documentation checks; full compilation and broad suites remain CI-owned

Browser evidence is retained in the task checkout at `reports/boon-implementation-review/` and `reports/block-hit-review/`. Inspected all ten Boons at 1280×720 with 125% text and 1920×1080 with default text, plus existing-portrait references, the reward selection and overflow Mana. Checked image decoding, layout assertions and computed keyword colors. Selected Rainkeeper, reloaded the saved journey and inspected the owned Boon. A blocked Light attack retained enemy Health, spent 8 Block, paid 4 Leech Healing and spent one stack of each retaliating Thorns pool. Both browser records contain no page errors. Owned preview processes were closed. These checks establish browser behavior and rendered fit, not desktop or hardware acceptance or artistic approval beyond the user's selected artwork.

## Intentional baseline changes

The modifier oracle now includes all 28 Boons and 332 modifier scenarios. The authored Talent and six-tier passive hashes remain unchanged; the Boon catalog hash changes for the ten additions. Every replay still checks accepted commands, detached previews, rejection identity, deterministic RNG and current-format save/resume before comparing its recorded hash. Save format 57 and source attribution necessarily change committed state hashes. The approved Block semantics alter the blocked reaction fixture in every scenario; combined scenarios also select all ten new Boons. The eight ability snapshots retain identical commands and Auto-play rankings, changing only committed/preview/enemy-turn hashes. Four combined-combat snapshots change their RNG and later plays because they now own all ten new Boons, including Critical Hit protection, card returns and Mana overflow. These are feature baselines, not an acceptance refresh for a refactor. Original diagnostic output and prior modifier hashes remain in the ignored evidence directory.

## Media and verification limits

Ten user-provided Drive PNG originals are retained unchanged; the shared lossless card recipe produces 720×960 WebP portraits. The manifest records source links and rights. The new selections add 7.11 MiB, bringing active media to 195 unique files / 136.79 MiB; the allowance increases from 136 to 144 MiB with the 3 MiB per-image ceiling unchanged. No quality reduction was introduced to fit the old allowance.

Hosted CI, complete static/type checks, broad unit/DOM/browser suites, balance simulations, desktop/native execution, packaging, physical controllers, Steam and Steam Deck were not run. The focused combined-combat scenarios are regression evidence, not a measured balance sweep. Nothing was pushed or published.
