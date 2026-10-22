# Creature inspection comparison

Historical comparison: production now uses centered creature artwork above a width-aligned row of native portrait abilities, the creature name, active passive and five progress stars; action cycling has no Previous/Next buttons. Battle has no pinned inspection. See [current inspection rules](../../Docs/UI.md#other-screens).

Open `/design/inspection/index.html` on the development server. Use the layout tabs to compare A (stacked) and B (side-by-side). Both use identical content, a 320×240 creature image, and three 96×128 action thumbnails. The layout tabs and Enemy switch are review controls, not proposed game UI. Add `?layout=side` to open B or `&enemy=1` to show the separately labeled Species kit.

Artwork surfaces, action tooltips, details, Dialog, Tabs, Switch, and Buttons use the game's shared components and semantic theme. Artwork stays full bleed without overlays: creatures 4:3, actions 3:4. No definitions are embedded into inspection; the menu Glossary remains the place for terminology.

Click a portrait thumbnail to replace the same dialog's contents with enlarged action inspection. Previous/Next, A/D, and controller left/right cycle through that creature's three cards. Back/Escape returns to the creature and focuses the current action's thumbnail; Escape again closes inspection. Closing with the X or outside click dismisses the entire dialog using normal shadcn behavior. This sandbox has local presentation state only and never changes saves. Layout A (stacked) was the initial approved direction; the later production kit layout supersedes it.

The Enemy switch shows battle health and effects separately from the collectible Species kit. It reveals no intents. The shared action artwork is a placeholder; production artwork is being handled separately.

Both compositions were rendered and inspected at 1920×1080 and 1280×800. Browser checks cover aspect ratios, fit, layout switching, enemy labeling, hover details, card cycling, Back/Escape, and focus restoration. Physical controller, native desktop, Windows, Steam client, and Steam Deck were not verified for this sample.
