# Icon button study

Open `/design/icon-buttons/index.html` through the development server. Uses the actual shadcn Button, RadioGroup, Switch and Tooltip, Lucide icons and the shared comparison styling. No gameplay or game saves load.

The first decision changes only the glyph size: 16px, 20px or 24px. Every sample uses a 44px square hit area, the same icon, and the user's [reviewed button baseline](../button-interactions/reviewed-choices.ts). Menu, Back, Close and both paging symbols can be tried with pointer and native keyboard input. Optional unavailable, busy and reduced-motion previews apply identically across options. Busy uses an internal spinner and external Working status, preserving the square hit area and an accessible action name.

The size choice persists in browser storage under `fauna-design-icon-size-v1`; storage failure keeps the visit usable. Hit area and tooltip timing remain separate future decisions. The current tooltip uses the shared immediate behavior. No production decisions are applied by this study. Controller and actual dialog/paging contexts remain pending.
