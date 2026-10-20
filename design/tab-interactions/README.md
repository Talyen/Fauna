# Tab interaction batch

Open `/design/tab-interactions/index.html`. Six consecutive independent decisions cover active fill, inactive hover fill, inter-tab spacing, horizontal padding, presence of icons, and color/border transition duration. Each step offers live candidates, a recommendation, saved choices and Next/Previous navigation. Review my batch combines explicit preferences and labels undecided baselines. Preferences use `fauna-design-tab-picks-v1`; storage failure preserves the current visit.

Actual registered shadcn Tabs own selection, roving focus, automatic activation and panel accessibility. Samples represent Settings categories and Collection filters; switching context resets only sample tab selection, retaining review choices. Native Left/Right, Home/End and Tab remain available. Narrow strip constrains the container to 260px; fixed-size controls scroll rather than shrinking. Tab heights remain at least 44px and optional Lucide icons are 20px.

Individual comparisons hold other properties at black active fill on a charcoal strip, subtle inactive hover, 4px inter-tab spacing, 12px horizontal padding, labels only and 150ms transitions. Gold fill uses its matching semantic text color for contrast. Content changes immediately regardless of transition duration. Reduced motion removes transitions.

To extend the reviewed single-highlight rule, active tabs strengthen their contiguous gold border from 2px to 3px on hover. Intentional keyboard focus replaces that border with the reviewed solid external outline, while active fill continues to identify selection. Pointer use removes focus decoration. This avoids stacking separate highlighted boundaries. It is a proposal for tab composition, pending user and context acceptance, rather than a production change.

No settings, gameplay, audio or game saves load. Screen compositions, controller/desktop input and full CI acceptance remain pending.
