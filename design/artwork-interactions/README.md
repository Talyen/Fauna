# Artwork interaction batch

Open `/design/artwork-interactions/index.html`. Six independent comparisons are available consecutively: hover frame thickness, pointer hover movement, selection ring distance, selection ring thickness, unavailable contrast and knockout contrast. Preferences are saved separately under `fauna-design-artwork-picks-v1`; unavailable browser storage leaves the visit usable. Recommendations and Next/Previous navigation support a batch without returning to chat between choices.

The actual ArtCard uses the registered shadcn Button. Creature art is 266⅔ × 200 CSS pixels; action art is 200 × 266⅔. Both retain their aspect ratio and a single image with no overlays. Change format to inspect both; viewport changes wrap rather than resize artwork. Samples use Mossback's prepared artwork and require the existing prepared asset directory. No gameplay, audio or game saves load.

Individual comparisons hold other properties at 2px inner hover frame, no pointer hover movement, 3px selection gap and 2px selection thickness. Selection comparisons start selected and allow toggling. Solid focus and 3.5% focus growth follow the reviewed button direction; on selected artwork, focus stays outside the selection ring with a 3px gap. This prevents the two indicators from merging. Reduced motion removes growth/lift and transitions.

Unavailable and knocked-out samples retain focus and hover details but cannot toggle selection. Unavailable artwork remains colored; knockout adds grayscale. Their opacity decisions are separate. The combined preview applies opacity only when its matching availability mode is selected. It combines explicit preferences, reports undecided values and permits selected-plus-focused review. These are selection samples, not implemented inspection, hand fan, combat targeting or reserve-swap flows.

Tooltips use the user's [reviewed choices](../tooltip-interactions/reviewed-choices.ts): immediate, above, 8px gap, 100ms fade and neutral border. Production UI is unchanged. Full context acceptance, controller, desktop and CI validation remain pending.
