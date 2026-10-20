# Icon button study

Open `/design/icon-buttons/index.html` through the development server. Uses the actual shadcn Button, RadioGroup, Switch and Tooltip, Lucide icons and the shared comparison styling. No gameplay or game saves load.

The first decision changes only the glyph size: 16px, 20px or 24px. Every sample uses a 44px square hit area, the same icon, and the user's [reviewed button baseline](../button-interactions/reviewed-choices.ts). Menu, Back, Close and both paging symbols can be tried with pointer and native keyboard input. Optional unavailable, busy and reduced-motion previews apply identically across options. Busy uses an internal spinner and external Working status, preserving the square hit area and an accessible action name.

The size choice persists in browser storage under `fauna-design-icon-size-v1`; storage failure keeps the visit usable. The user chose 20px on 2026-10-20. That recorded size is fixed in the next step; it does not change the saved icon-size choice. Tooltip timing remains a separate future decision. The current tooltip uses the shared immediate behavior. No production decisions are applied by this study. Controller and actual dialog/paging contexts remain pending.

## Hit area

Open `/design/icon-buttons/index.html?step=hit-area`. Compare 44px, 48px and 52px square buttons with the same reviewed 20px glyph, icons and interaction treatment. Only the button dimensions change. Visible surfaces match clickable boundaries; there is no invisible padding. Dimensions describe the resting button; chosen hover growth and pressed shrink still apply. The recommendation is 44px to match existing control height; larger options trade space for easier pointing.

Hit-area preferences use a separate browser-storage key, `fauna-design-icon-hit-area-v1`. No option is selected in advance. The icon-size review remains accessible using Review icon size; its stored preference is preserved. Other state previews remain identical across all candidates.
