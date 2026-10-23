# UI adoption verification record

Historical scope: the October 20, 2026 shadcn adoption and its subsequent verification notes. These observations predate later screen revisions and are not acceptance evidence for current main. Current behavior belongs to [UI contracts](../UI.md), [screen specifications](../ui/screens.md) and the [implementation map](../DESIGN_SYSTEM.md). Source-control history retains the original rollout table; [phone decisions](../../design/PHONE_DECISIONS.md) and the design studies retain explicit user choices.

## Verification boundaries

Focused tests cover Settings persistence, menu browsing and talent purchase/reset, collection reachability/focus, combat inspection, reward totals, tooltip behavior, source-policy violations and animation ownership. Motion ownership tests use simulated DOM/WAAPI, not rendered motion acceptance. Focused real-browser review uses a fresh preview origin and actual player flows; screenshots and exact coverage are recorded with task handoff.

Full static analysis, builds, exhaustive viewport/input journeys and hosted CI remain CI-owned. Native desktop, Windows packaging, Steam/Steam Deck and physical-controller verification are separate and pending. Sound selection and mix require a listening pass. These boundaries do not authorize dropping behavior or weakening tests. Future UI decisions should be tried in the studies, then moved into these owners after approval.

### Focused browser evidence

The implementation was reviewed through a fresh preview origin using the actual player flow: main menu, Settings at 100% and 125%, starter inspection/choice, destination inspection, battle targeting, committed attack and support, End turn, hand cleanup, Pause and talent category navigation. Pointer target acceptance, Health/Mana updates, icon-only status colors, default audio levels, modal return focus and zero leftover transfer copies were observed without browser console errors. That earlier review included short/narrow layouts that allowed scrolling; it predates the current scroll-free contract and does not validate the replacement composition. The browser review caught and corrected a status-details focus fallback that disrupted target clicks; a focused regression protects it.

This is focused local browser evidence, not the complete CI viewport/input/state matrix. The activation clip was prepared with a pending listening marker; no listening approval is claimed. That interaction rollout left authored gameplay talents unchanged. The subsequent [talent expansion](../KEYWORDS.md#classification-and-progression) adds all applicable Alchemy effects for shared categories; its rendered review remains pending.

The Alchemy-style talents layout and responsive overview exception require fresh CI rendered review at the supported viewports and 125% text; earlier browser evidence above does not validate this redesign.
