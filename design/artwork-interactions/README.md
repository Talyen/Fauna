# Artwork interaction batch

Open `/design/artwork-interactions/index.html`. Six independent comparisons are available consecutively: hover frame thickness, pointer hover movement, selection ring distance, selection ring thickness, unavailable contrast and knockout contrast. Preferences are saved separately under `fauna-design-artwork-picks-v1`; unavailable browser storage leaves the visit usable. Recommendations and Next/Previous navigation support a batch without returning to chat between choices.

The actual ArtCard uses the registered shadcn Button. Creature art is 266⅔ × 200 CSS pixels; action art is 200 × 266⅔. Both retain their aspect ratio and a single image with no overlays. Change format to inspect both; viewport changes wrap rather than resize artwork. Samples use Mossback's prepared artwork and require the existing prepared asset directory. No gameplay, audio or game saves load.

Individual comparisons hold other properties at 2px inner hover frame, no pointer hover movement, 3px selection gap and 2px selection thickness. Selection comparisons start selected and allow toggling. Solid focus and 3.5% focus growth follow the reviewed button direction; on selected artwork, focus stays outside the selection ring with a 3px gap. This prevents the two indicators from merging. Reduced motion removes growth/lift and transitions.

Unavailable and knocked-out samples retain focus and hover details but cannot toggle selection. Unavailable artwork remains colored; knockout adds grayscale. Their opacity decisions are separate. The combined preview applies opacity only when its matching availability mode is selected. It combines explicit preferences, reports undecided values and permits selected-plus-focused review. These are selection samples, not implemented inspection, hand fan, combat targeting or reserve-swap flows.

Tooltips use the user's [reviewed choices](../tooltip-interactions/reviewed-choices.ts): immediate, above, 8px gap, 100ms fade and neutral border. Production UI is unchanged. Full context acceptance, controller, desktop and CI validation remain pending.

## Reviewed choices and selected-hover refinement

The user supplied: 2px hover frame, 3.5% hover growth, 3px selection gap, 2px selection thickness, 45% unavailable opacity, and 45% knockout opacity. These are recorded in [reviewed choices](reviewed-choices.ts). The user then rejected the double highlighted border on selected-plus-hovered cards.

Open `/design/artwork-interactions/index.html?step=selected-hover` for the refinement. Both candidates suppress the inner hover frame while selected. Keep single ring retains the chosen 2px selection ring; Strengthen single ring expands that same ring to 3px on hover. All other properties use the six reviewed choices, with availability enabled. Both retain 3.5% growth. Cards begin selected; deselecting restores the usual hover frame, and selecting restores the single-ring treatment. The new preference is independent and undecided until chosen. Keyboard focus remains a separate outer outline. No production artwork behavior changes.

The user chose **Strengthen single ring** on 2026-10-20. The reviewed baseline now includes `selectedHover: stronger`; combined artwork uses that accepted default, with browser edits still available for further review. Selected cards suppress the inner hover frame and thicken the same selection ring from 2px to 3px on hover. Deselecting restores the normal hover frame. The next [tab interaction batch](../tab-interactions/README.md) provides six consecutive decisions.
