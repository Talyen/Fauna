# Fauna visual references

Use this pack with the repo [UI design](../../.agents/skills/fauna-ui-design/SKILL.md), [UI critique](../../.agents/skills/fauna-ui-critique/SKILL.md) and [art direction](../../.agents/skills/fauna-art-direction/SKILL.md) skills. [UI contracts](../../Docs/UI.md) own behavior, accessibility, layout and tokens; this pack supplies visual evidence and preference records. Open the images before applying a reference.

## Reference status

- **Established contract:** an existing implementation illustrating a specific documented rule; this does not mean the user approved the whole image
- **Candidate:** an agent's proposed direction, awaiting the user's judgment
- **User approved:** an image the user explicitly selected, with the choice date and scope recorded here
- **Counterexample:** a specific visible weakness to avoid, not a ban on everything in the image

On 2026-10-22 the user rejected both Merchant designs and preferred A over B. A was restored after that feedback; the later [user-directed revision](references/merchant-current-1280.png) is now implemented with names in inspection, secondary purchase controls, Gold in the header and a centered italic “Limit 1 per customer - No Refunds!” line above the shelf. Prices now roll independently from 20–40 Gold and persist with the offers. Its aesthetic acceptance remains pending. Neither is an approved whole-screen reference. Never infer approval from integration, passing checks or silence. The older [battle A composition](../battle-layout/README.md) and [interaction decisions](../PHONE_DECISIONS.md) retain only their documented scope; current contracts supersede outdated details.

## Whole-screen reference set

| Reference                                            | Status                                         | Carry forward                                                                                                           | Do not infer                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Settings](references/settings-1920.png)             | Established contract                           | Restrained palette, bounded content width, aligned labels/values and standard controls                                  | The repeated Display label and separators are not an endorsed aesthetic requirement                                                                      |
| [Battle](references/battle-1920.png)                 | Established contract                           | Artwork dominates, meaningful row ordering, overlapping hand, one strong End turn action                                | The sparse idle image does not establish targeting, readability of every state, motion or native acceptance                                              |
| [Merchant A](references/merchant-before-1280.png)    | Preferred over B; still rejected aesthetically | Preserve original illustrations, aspect ratios and accessible controls                                                  | Earlier claims that equal purchase emphasis and hover-only rules were defects are withdrawn; the user preferred A and later specified individual changes |
| [Merchant B](references/merchant-candidate-1280.png) | Rejected; not a positive reference             | Inspect the failed attempt: visible effects, aligned rows and neutral buttons did not deliver an acceptable composition | Do not reuse this composition as an improvement template                                                                                                 |

View the [unbiased A/B sheet](comparison.html), [enlarged-text comparison A](references/merchant-before-1280-large.png), [enlarged-text comparison B](references/merchant-candidate-1280-large.png), and [pilot review](PILOT.md). At 1920×1080: [A](references/merchant-before-1920.png), [B](references/merchant-candidate-1920.png). Labels A/B identify options without a recommendation badge; the review record separately explains the implementation hypothesis.

The current requested composition is shown at [1280×720](references/merchant-current-1280.png), [125% text](references/merchant-current-1280-large.png), [1920×1080](references/merchant-current-1920.png) and [hover inspection](references/merchant-current-inspection.png). The [current evidence manifest](references/current-evidence.json) binds these captures to their source. These images document implementation of explicit choices; they are not yet approved aesthetic references.

## Artwork references

Inspect [Lucky Clover](../../public/art/boons/lucky-clover.webp), [Grove's Favor](../../public/art/boons/groves-favor.webp) and [Brass Censer](../../public/art/boons/brass-censer.webp) together and in the Merchant frames above. These are existing project assets, reused unchanged in the pilot. Their prominent object silhouettes, angular color shapes and warm metal accents are concrete comparison points for related Boon assets, not a new universal style mandate. The Battle image provides creature/action context. Check value separation, background activity, light direction and silhouette at the actual 160px/200px short side, rather than judging only a large source image. Maintain the [source and preparation contracts](../../Docs/CONTENT.md#artwork-contracts).

## Workflow

1. Inspect the current whole screen and identify the player's decision, existing disclosure layers and requested visual direction
2. Select a positively accepted reference when available and the exact relationship it establishes; do not treat an existing or rejected screen as a positive aesthetic standard; keep artistic preference and mandatory behavior distinct
3. Compose artwork, hierarchy, grouping, space and actions before tuning individual controls
4. Audit visible copy: every phrase must support a choice, rule, availability or outcome; delete repeated meaning and obvious instructions while preserving accessible names
5. Capture matching before/after states through the real player flow; use default text at 1920×1080 and enlarged text at 1280×720, plus the changed interaction and affected exceptional state
6. Apply the critique skill to actual images; correct concrete defects, recapture and record exact coverage before technical integration
7. For unresolved taste, show two comparable options and ask which the user prefers; record the selected image, date and scope here before promoting it

Do not substitute numeric self-ratings, an exhaustive checklist, source-policy compliance or a successful build for visual judgment. A screenshot regression can preserve an unattractive design. The [benchmark](BENCHMARK.md) tests whether this workflow changes decisions and outcomes, rather than merely producing more documentation.

## Repeatable evidence

Start a task-owned quiet preview with `npm run preview:task`. In a second terminal at that same checkout, run the focused capture script against the printed loopback origin:

```sh
node design/visual-quality/capture.mjs http://127.0.0.1:PORT candidate
```

Replace PORT with the actual port. The script requires a quiet-preview identity, creates fresh disposable browser contexts, uses deterministic gameplay fixtures and writes screenshots plus coverage metadata under reports/visual-quality. It exercises only this Merchant flow and captures Settings/Battle benchmark frames; it does not invoke the full browser suite or build. It closes its browser and fixture server, leaving preview cleanup to the preview owner. Inspect the resulting images yourself. Capture the before state before editing; the script does not reconstruct historical source. Copy selected reviewed images into this pack with source/conditions recorded in the pilot. Preserve accepted references when adding a new candidate.

## Memento and battle artwork review

The [Legendary battle](references/memento-battle-1920.png), [full-roster Swap](references/memento-swap-1280.png) and [Minion targeting](references/memento-targeting-1280.png) captures document the initial Memento implementation. Chromium review used fresh saves, reduced motion, 1920×1080 at default text and 1280×720 at 125% text. The Legendary stays centered, six-card hands retain 3:4 contain rendering, and Swap exposes all five roster creatures without headings or pagination. Fitted combatant artwork contracts when dense effects require more room; text and 44px controls retain their sizes. Source and generated artwork remain proposed pending user preference. These captures do not establish CI, native-platform, controller or balance acceptance.

## Tournelle and required replacements

The [Tournelle creature reference](../../Docs/content/creatures/tournelle.md#rendered-review) links focused Collection, battle, rank and knockout-replacement captures. These document implementation of the user's selected kit and unchanged Drive artwork, including removal of voluntary Swap and Lineup controls. The [evidence record](references/tournelle-evidence.json) records viewport/input coverage and limits; technical review does not establish balance or platform acceptance

## Creature inspection and recruitment

The user requested implementation of a symmetrical artwork-first composition on October 22, 2026: creature name as the main heading, native 4:3 artwork above three native 3:4 abilities with matching outer row edges, the current named passive and five stars above its description. Stars are empty at the base tier and fill with permanent rank. Ability rules remain in hover/focus details. Inspection never recruits; a separate Recruit button beneath each starter or Victory offer commits that choice. This supersedes the rejected original panel, compact tooltip-passive proposal and earlier rank-layout studies.

The [implementation evidence](references/inspection-implementation.json) records [minimum viewport with enlarged text](references/inspection-aligned-1280.png), [1920×1080](references/inspection-aligned-1920.png), [three recruit offers](references/recruit-buttons-1920.png) and [maximum-rank inspection](references/inspection-max-rank-1280.png). Shared ArtCard surfaces preserve full source illustrations without cropping, unlike approximate image-generation geometry. The bounded Chromium review exercised artwork inspection, ability hover/enlargement, Escape and focus return, recruitment, drafting resume and a Legendary draft. Keyboard navigation and both focused browser and DOM coverage also exercise full-roster replacement and cancellation. The requested composition is implemented; these captures are implementation evidence, not a separately accepted whole-screen aesthetic reference. Full CI and native platform verification remain pending.

### Inspection artwork sizing follow-up

The user subsequently requested the inspection creature artwork 20% smaller and each ability 20% larger, intentionally replacing the matching outer edges with a narrower hero and wider centered ability row. The native 4:3 and 3:4 aspect ratios and 12px ability gaps remain intact. Starter Recruit buttons now fit their text and the final required Recruit starts the journey without a Begin journey control. [Current minimum viewport](references/inspection-resized-1280.png), [current 1920×1080](references/inspection-resized-1920.png), [starter buttons](references/starter-content-buttons-1920.png) and [measured size evidence](references/inspection-resizing.json) supersede the earlier sizing evidence. Bounded Chromium review confirmed 0.8× creature width, 1.2× individual ability width, fit, hover, enlargement, focus return, automatic start and resume at both recorded sizes.
