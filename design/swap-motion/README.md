# Swap arc height

Open `/design/swap-motion/index.html` to compare 16px, 32px and 48px opposing arcs on fixed-size Fauna ArtCards. Preview height changes only the path curvature. Choose saves an explicit preference under `fauna-design-swap-arc-v1`; Copy choice exports it. Previewing does not save a choice.

Select a creature, then the other, or use Swap again. Local slot ownership changes immediately. Decorative flights run for 150ms with cubic ease-out travel and a squared-sine bend, returning exactly to their endpoint. Repeat during movement to retarget from the visible pose. Slow motion uses 600ms solely for inspection. Native/system reduced motion cancels flights and removes the selected lift; unmount cancels owned animations. Real shadcn Buttons, RadioGroup and Switch retain keyboard behavior, with ArtCard as the artwork surface.

The accepted 4px/150ms selection lift, unchanged single-ring thickness on hover and fixed artwork dimensions remain. No game state, progression, saves or audio load. This isolated two-slot composition is for motion comparison, not full Lineup/Swap layout acceptance. Production adoption is recorded in the [shared design system](../../Docs/DESIGN_SYSTEM.md); full CI journeys, desktop and physical-controller review remain separate.

The [shared motion contract](../../Docs/UI.md#shared-control-states-and-feedback) owns the selected production behavior. The 600ms slow-motion setting is an inspection aid.
