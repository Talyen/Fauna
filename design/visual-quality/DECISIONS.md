# Fauna visual decision records

> **Status/source:** dated implementation observations and explicit user choices; each section retains source/image identities, conditions and exercised interactions
>
> **Current owners:** [reference status and image index](README.md) and [UI review procedure](../../Docs/UI.md#required-review)
>
> **Evidence:** Chromium simulation only; no full CI, native desktop, Windows packaging, physical-controller, Steam-client, Steam Deck or measured-balance acceptance; artistic approval covers only explicit user choices, not current main

## Merchant

On October 22, 2026, the user rejected both Merchant designs and preferred A over B. Neither is an approved whole-screen reference. The [pilot record](PILOT.md) owns the experiment, restoration, subsequent requested revisions and their attempt-specific checks; the current requested composition remains pending aesthetic acceptance. Current behavior belongs to the [Merchant specification](../../Docs/ui/screens.md#boon-merchant).

View the [unbiased A/B sheet](comparison.html), [enlarged-text comparison A](references/merchant-before-1280-large.png), [enlarged-text comparison B](references/merchant-candidate-1280-large.png), and [pilot review](PILOT.md). At 1920×1080: [A](references/merchant-before-1920.png), [B](references/merchant-candidate-1920.png). Labels A/B identify options without a recommendation badge; the review record separately explains the implementation hypothesis.

The current requested composition is shown at [1280×720](references/merchant-current-1280.png), [125% text](references/merchant-current-1280-large.png), [1920×1080](references/merchant-current-1920.png) and [hover inspection](references/merchant-current-inspection.png). The [current evidence manifest](references/current-evidence.json) binds these captures to their source. These images document implementation of explicit choices; they are not yet approved aesthetic references.

## Artwork references

Inspect [Lucky Clover](../../public/art/boons/lucky-clover.webp), [Grove's Favor](../../public/art/boons/groves-favor.webp) and [Brass Censer](../../public/art/boons/brass-censer.webp) together and in the Merchant frames above. These are existing project assets, reused unchanged in the pilot. Their prominent object silhouettes, angular color shapes and warm metal accents are concrete comparison points for related Boon assets, not a new universal style mandate. The Battle image provides creature/action context. Check value separation, background activity, light direction and silhouette at the actual 160px/200px short side, rather than judging only a large source image. Maintain the [source and preparation contracts](../../Docs/CONTENT.md#artwork-contracts).

## Repeatable evidence

Start a task-owned quiet preview with `npm run preview:task`. In a second terminal at that same checkout, run the focused capture script against the printed loopback origin:

```sh
node design/visual-quality/capture.mjs http://127.0.0.1:PORT candidate
```

Replace PORT with the actual port. The script requires a quiet-preview identity, creates fresh disposable browser contexts, uses deterministic gameplay fixtures and writes screenshots plus coverage metadata under reports/visual-quality. It exercises only this Merchant flow and captures Settings/Battle benchmark frames; it does not invoke the full browser suite or build. It closes its browser and fixture server, leaving preview cleanup to the preview owner. Inspect the resulting images yourself. Capture the before state before editing; the script does not reconstruct historical source. Copy selected reviewed images into this pack with source/conditions recorded in the pilot. Preserve accepted references when adding a new candidate.

## Memento and battle artwork review

The [Legendary battle](references/memento-battle-1920.png), [full-roster Swap](references/memento-swap-1280.png) and [Minion targeting](references/memento-targeting-1280.png) captures document the initial Memento implementation. Chromium review used fresh saves, reduced motion, 1920×1080 at default text and 1280×720 at 125% text. The Legendary stays centered, six-card hands retain 3:4 contain rendering, and Swap exposes all five roster creatures without headings or pagination. Fitted combatant artwork contracts when dense effects require more room; text and 44px controls retain their sizes. Source and generated artwork remain proposed pending user preference.

## Tournelle and required replacements

The user's selected kit and unchanged Drive artwork are documented in the [creature reference](../../Docs/content/creatures/tournelle.md). This implementation also removed voluntary Swap and Lineup controls.

Focused Chromium review inspected the unchanged artwork in [Collection at 1280×720 with 125% text](references/tournelle-collection-1280.png), [battle at 1920×1080](references/tournelle-kit-1920.png), [required replacement](references/tournelle-replacement-1280.png), [four Legendary backups](references/tournelle-legendary-1280.png) and [Gallantry's final tier](references/tournelle-rank-five-1280.png). The [evidence record](references/tournelle-evidence.json) records conditions and limits. Whole-screen review found readable, uncropped artwork and reachable choices without overflow. Keyboard, mouse and standard-mapped controller simulation covered replacement and focus return; successive choices survive reload.

## Creature inspection and recruitment

The user requested implementation of a symmetrical artwork-first composition on October 22, 2026: creature name as the main heading, native 4:3 artwork above three native 3:4 abilities with matching outer row edges, the current named passive and five stars above its description. Stars are empty at the base tier and fill with permanent rank. Ability rules remain in hover/focus details. Inspection never recruits; a separate Recruit button beneath each starter or Victory offer commits that choice. This supersedes the rejected original panel, compact tooltip-passive proposal and earlier rank-layout studies.

The [implementation evidence](references/inspection-implementation.json) records [minimum viewport with enlarged text](references/inspection-aligned-1280.png), [1920×1080](references/inspection-aligned-1920.png), [three recruit offers](references/recruit-buttons-1920.png) and [maximum-rank inspection](references/inspection-max-rank-1280.png). Shared ArtCard surfaces preserve full source illustrations without cropping, unlike approximate image-generation geometry. The bounded Chromium review exercised artwork inspection, ability hover/enlargement, Escape and focus return, recruitment, drafting resume and a Legendary draft. Keyboard navigation and both focused browser and DOM coverage also exercise full-roster replacement and cancellation. The requested composition is implemented; these captures are implementation evidence, not a separately accepted whole-screen aesthetic reference.

### Inspection artwork sizing follow-up

The user subsequently requested the inspection creature artwork 20% smaller and each ability 20% larger, intentionally replacing the matching outer edges with a narrower hero and wider centered ability row. The native 4:3 and 3:4 aspect ratios and 12px ability gaps remain intact. Starter Recruit buttons now fit their text and the final required Recruit starts the journey without a Begin journey control. [Current minimum viewport](references/inspection-resized-1280.png), [current 1920×1080](references/inspection-resized-1920.png), [starter buttons](references/starter-content-buttons-1920.png) and [measured size evidence](references/inspection-resizing.json) supersede the earlier sizing evidence. Bounded Chromium review confirmed 0.8× creature width, 1.2× individual ability width, fit, hover, enlargement, focus return, automatic start and resume at both recorded sizes.

### Collection inspection follow-up — 2026-10-22

The user explicitly chose the exact new inspector for Collection, showing only the current passive instead of retaining the old Base abilities and Rank progression tabs. Collection now opens the shared inspector, preserving its artwork sizing, five stars, hover/focus rules and action enlargement. Collection requests base species abilities without journey upgrades, talents or combat modifiers; permanent passive rank still applies.

Matching Chromium captures were inspected at 1280×720 with 125% text and 1920×1080 with default text, using reduced motion and the same seed-42 checkpoint. Baseline evidence is under the main checkout's `reports/review/before-collection-inspection-e1c36660-75a4-4883-9494-6140e600db01`; final evidence is under the retained `collection-inspection` task checkout's `reports/review/collection-inspection-final-b616914b-d963-442f-86ec-26ec482b0734`. Eight focused browser checks passed: locked species, mouse/keyboard/simulated-controller action inspection and return focus, both artwork-ratio/hover-rule viewports, later-page resize/filter preservation and the enlarged-text controller menu journey. DOM coverage also protects base ability values, costs, current stars, action cycling and unchanged committed state.

## Recruitment team tray — 2026-10-22

The user selected the [single-action team tray concept](references/recruit-team-concept.png): centered Choose your team heading, one exchange artwork and swap icon above a quiet Team tray, all five roster artworks visible, and one centered Confirm action. Creature names, Health, bars, explanatory outsider labels, Back, Cancel and a separate Keep current team action are omitted at rest. Names and rules remain available through focus/hover and inspection. Acceptance covers this composition and interaction direction; generated creature art and approximate geometry are not production artwork references.

Recruit commits Collection progress before this screen. The original roster is the initial preview. Artwork exchanges immediately preview one replacement, using the same curved animation as battle swaps; activating the selected member or upper artwork reverses the preview. Confirm accepts the displayed team, including an unchanged roster. Animation never blocks input or confirms a choice. Previews are local and disposable; reload resumes the banked recruit with the original team.

Rendered implementation review used the focused `recruit-replacement` and `recruit-team-preview` scenarios at 1280×720 with 125% text and 1920×1080 with default text, plus 1280×1080 with 125% text. All five creatures and Confirm remain visible without scrolling. Task-local evidence is retained under `reports/review/recruit-team-final-d41a2ccf-0d4d-409b-9f53-d21e68948ebc`, `reports/review/recruit-team-preview-final-63edcef2-fde9-4660-8fbd-7019fddb8ee4` and `reports/review/recruit-team-tall-final-cef95713-46f6-4a33-ac2f-6142b93e7353`. The earnings captures in `reports/review/recruit-xp-final-05e361eb-796e-412d-aae6-7d838f12107f` verify the shorter keyword-colored XP bars and level labels.

A separate fresh Chromium session exercised reward continuation, recruitment without Skip, replacement, retargeting, undo, reload into the banked choice and confirmation into the next encounter. Arc geometry was inspected with a temporary slower motion token, then restored to the battle timing; `reports/recruit-team-implemented.png` shows the normal-speed settled preview. Unit coverage additionally accepts Confirm with animation frames held, checks cleanup, and verifies previews never save.

## Rookhaven implementation review

Conditions: reduced motion; the seven-card hand and six rank pages below describe that historical fixture, not current gameplay or Collection layout.

The four source images were inspected together at card-like scale. Focused Chromium review covered the Collection kit, all six rank pages, a full seven-card battle hand, the copied-card tooltip, selection and execution of all three abilities, and copy persistence after reload at 1920×1080 with default text and 1280×720 with 125% text. The source set retained readable silhouettes and uncropped compositions at those sizes; rules, target feedback and controls fit without scrolling. Review caught and corrected missing all-enemy UI targeting for Unwritten Ending, with a keyboard confirmation regression added to the targeting suite. The task preview used isolated dependency caches after an outdated Vite optimization cache prevented its initial load. Screenshots and geometry/error metadata are preserved in task reports.

## Euphera implementation review

Focused Chromium review covered Collection, all six passive tiers, battle targeting and cancellation, Thorns removal, Block redistribution and hand replacement at 1920×1080 with default text and 1280×720 with 125% text, using fresh disposable saves and reduced motion. The four compositions remain uncropped and readable at shared card sizes; the selected rules and controls fit without scrolling. Task screenshots and interaction evidence are retained with the archived worktree reports.
