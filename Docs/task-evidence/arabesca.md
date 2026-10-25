# Arabesca implementation evidence

Date: October 25, 2026

[Creature rules and provenance](../content/creatures/arabesca.md) · [Selected mechanics regressions](../../tests/unit/game/ability-contracts.test.ts)

## Scope

The owner selected Ribbon Snare (6 Stun), Springbound (allied Freeze buildup removal and self 30% temporary Dodge), Dancing Double (the next shared card resolves twice), and Petalwake (allied Dodge healing including Arabesca). The complete passive tiers restore 1/2/3/4/5/6 Health. Existing artwork selections, allied targeting and ordinary progression remain in their established owners.

## Local checks

- Asset preparation passed: 194 selections validated, 190 cache hits and four new prepared images
- The changed-file lightweight gate passed formatting, syntax lint, source boundaries, modifier ownership and documentation checks
- One exact bounded unit command ran: `npm test -- tests/unit/game/ability-contracts.test.ts`; 29 tests passed and one failed because the new test incorrectly expected Burn from Ember Charge, whose authored damage is Physical
- Corrected that assertion and its XP expectation, and added the doubled Armor assertion; no second unit command was launched under the one-command local test policy
- Browser interaction verified the corrected teammate scenario independently: two full Ember Charge resolutions grant four Armor, spend one Mana, award one Physical XP and increment its owner's accepted-play count once
- Final source review moved repeat consumption ahead of before-ability reactions so an admitted card spends the grant even if a preceding reaction knocks out its actor; a focused regression for this edge was added afterward and remains unrun locally

The historical ability and modifier digests normalize the neutral new save envelope, retain active repeat grants, and preserve existing expectations. Arabesca's new authoring and all six passive tiers have direct assertions. Other normalized baseline suites were not run locally. Full compilation, all regressions and hosted CI remain pending; local checks do not establish those gates.

## Rendered review

Browser runtime: isolated Vite preview with reduced motion; fresh contexts and disposable fixture saves. Inspected complete frames at 1280×720 with 125% text and 1920×1080 with default text. All eight standard captures completed without layout failures or browser errors:

| State                        | Evidence directory under the task checkout                                 |
| ---------------------------- | -------------------------------------------------------------------------- |
| Base Collection inspection   | `reports/review/arabesca-collection-7577280b-b0f5-43bc-a580-e8b9a2a10a56/` |
| Battle and portrait/hand art | `reports/review/arabesca-battle-dff0ff73-aa1c-41cd-bfa8-74d50dea618a/`     |
| Pending shared double        | `reports/review/arabesca-double-41cf28ac-624f-4bc4-87cf-d3ef20085fa0/`     |
| Maximum passive tier         | `reports/review/arabesca-rank-five-f851f338-9cff-469c-8eb0-d9cf8823901f/`  |

The Collection composition retains readable passive copy, the five-star display and three distinct uncropped ability illustrations. The portrait reads at battle scale. The pending Next card ×2 status fits above End turn at both sizes, and the battlefield/hand retain their composition. No visual correction was required. These are agent review observations, separate from the owner's artwork/mechanic selections and any later artistic acceptance.

## Exercised interactions

At 1280×720 and 125% text:

- Played Dancing Double through the hand; the pending status appeared and the save recorded the shared grant
- Selected Ribbon Snare and cancelled with Escape; focus returned to its hand card, with revision, Mana and repeat grant unchanged
- Played Springbound after Dancing Double; allied buildup cleared, Arabesca gained 60% temporary Dodge, other allies gained no Dodge, Mana became two and the pending status disappeared
- Played a teammate's Ember Charge after Dancing Double; full effects repeated with one payment and one XP/count award
- Verified an unaffordable Dancing Double remains unavailable and a forced attempted activation retains the saved revision

The first interaction script completed the Springbound and teammate checks, then Playwright refused to click the intentionally disabled card and timed out. Their screenshots remain in `reports/arabesca-review/spring-1280.png` and `teammate-1280.png`. The corrected driver exercised only the remaining unavailable state; `reports/arabesca-review/interactions-unavailable.json` records its successful result. This was a driver correction, with no product change. Initial capture admission was busy and launched no work; later admitted captures completed. Task-owned previews were closed.

## Boundaries

No broad browser suite, balance sweep, compiler, production build, native desktop, Windows package, physical controller, Steam client or Steam Deck verification ran. The focused source and browser observations do not claim measured balance or complete platform qualification. Retained reports identify their checkpoint, conditions and source fingerprint; the subsequent repeat-consumption ordering correction does not alter their pictured states.
