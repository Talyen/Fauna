# Visual direction

These choices guide future design. Current behavior belongs to the [UI contracts](../../Docs/UI.md), and changes require the [rendered review procedure](../../Docs/UI.md#required-review). Existing screenshots and implementation do not imply approval of an entire screen.

## Merchant

The user rejected both [Merchant A](references/merchant-before-1280.png) and [Merchant B](references/merchant-candidate-1280.png), preferring A over B. Neither is an approved whole-screen reference. Names and rules belong in hover/focus inspection; equal emphasis for equivalent choices is acceptable. Preserve original illustrations and their aspect ratios. The requested layout places Gold in the header, keeps the title centered, places the shelf policy above the Boons, and uses secondary purchase controls and gold Coins icons. The [current composition](references/merchant-current-1280.png) remains pending aesthetic acceptance. [Merchant specifications](../../Docs/ui/screens.md#boon-merchant) own current behavior.

## Artwork references

Inspect [Lucky Clover](../../public/art/boons/lucky-clover.webp), [Grove's Favor](../../public/art/boons/groves-favor.webp) and [Brass Censer](../../public/art/boons/brass-censer.webp) together and in the Merchant frames. Their prominent object silhouettes, angular color shapes and warm metal accents are comparison points for related Boon assets, not a universal style mandate. Check value separation, background activity, light direction and silhouette at actual card size. Follow the [source and preparation contracts](../../Docs/CONTENT.md#artwork-contracts).

## Creature inspection and recruitment

The selected inspector is artwork-first: name as the main heading, native 4:3 creature artwork above three native 3:4 abilities, the current passive and five stars. Empty stars represent the base tier; permanent rank fills them. Ability rules appear on hover/focus. Collection uses the same inspector for base species abilities. The creature artwork is narrower than the centered ability row. Inspection does not recruit; a separate Recruit action commits the choice. See the [screen specifications](../../Docs/ui/screens.md#creature-and-action-inspection) for current behavior.

The user selected the [team tray concept](references/recruit-team-concept.png): one exchange artwork above a quiet tray showing all five roster artworks, with one centered Confirm action. Its generated creature art and approximate geometry are not production artwork references. The [replacement specification](../../Docs/ui/screens.md#replace-a-creature) owns current behavior.

## Repeatable evidence

Start a task-owned quiet preview with `npm run preview:task`. In a second terminal at the same checkout, run the focused capture against its printed loopback origin:

```sh
node design/visual-quality/capture.mjs http://127.0.0.1:PORT candidate
```

Replace PORT with the actual port. The script requires a quiet-preview identity, creates disposable browser contexts, exercises the Merchant flow and captures Settings and Battle frames under `reports/visual-quality`. It closes its browser and fixture server; the preview owner closes the preview. Inspect the images yourself and capture the before state before editing. The script does not reconstruct historical source. Preserve accepted references and record the scope of any new choice.
