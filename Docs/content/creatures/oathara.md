# Oathara

Oathara is a 30-Health ordinary support creature, “The keeper of unfinished journeys”
The user selected its kit on October 23, 2026

| Ability         | Rules                                                   |
| --------------- | ------------------------------------------------------- |
| Never Lost      | Shuffle your hand into your deck / Draw that many cards |
| Traveler’s Ward | Reflect the next attack                                 |
| Vow of Return   | Resurrect an ally                                       |

All three cost 1 Mana. Unfinished Journey lets Oathara play 1, 2, 3, 4, 5 or 6 fallen ally cards per turn at zero through five stars. It grants access, not free plays, generated cards, a second passive or another progression system

## Identity and ownership

The portrait depicts a watchful, cream-and-black bird beside an inscribed stone, with golden fields and a road leading toward a distant city. The user interpreted the stone as grave imagery and chose an identity centered on fallen companions. The selected actions reveal a luminous road, shield a traveler with a great feather, and circle a restored stone with a golden feather

A living deployed Oathara performs a knocked-out deployed ally’s card from the normal hand. The card retains its original owner, definition, effects, Mana cost and draw/discard position. Oathara supplies the actor’s current combat state and passive; it does not inherit the fallen creature’s passive. Ordinary talent-based cost modifiers still apply to the acting creature

Each accepted borrowed play spends one allowance before its effects resolve. Repeated effects spend no additional allowance. Rejected commands preserve state and RNG. A counter belongs to each Oathara, survives swaps, resurrection and save/resume, and resets at that creature’s next turn start. Duplicate Oatharas use the first available living, uncontrolled provider in formation order, with separate allowances

While a living Oathara is deployed, fallen owners’ cards remain eligible for ordinary draws, keyword draws and discard recovery, including after its allowance is spent. They stay visible but unavailable when no guide can act. A fallen provider and a living provider in backup grant no access. Formation changes retain their existing kit replacement and pile rules; Unfinished Journey does not add reserve kits to the deck

Ordinary enemy Oathara uses the base tier and may choose an eligible ability from a fallen enemy’s kit during its normal action window. It uses its own combat state and room power. Its hand-exchange ability is unavailable to enemies without a hand. Resurrection selects a knocked-out enemy ally, with ordinary victory settlement still taking priority after the final enemy falls

## Shared mechanics

- Never Lost uses the existing redraw owner: the played card leaves the hand first, the remaining visible hand returns to the deck, and that many ordinary draws occur. Buffered draws retain FIFO priority. Card identities and ownership remain unchanged
- Traveler’s Ward grants one non-stacking [Attack Reflection](../../KEYWORDS.md#attack-reflection) protection to its actor. An incoming attack returns to the attacker after interception and Negate, before Dodge or defenses. Harmful authored follow-ups return too; other area recipients and the attacker’s support benefits keep their ordinary owners. A reflected attack cannot reflect again, but normal defenses apply. A repeated attack resolves separately. Periodic and proc damage and Blind misses do not consume the ward. It survives swaps and saves and can be Purged
- [Resurrect](../../KEYWORDS.md#resurrection) returns a knocked-out roster ally, including backup, with 20% of maximum Health, rounded normally with a minimum of one. It is direct restoration of life, unaffected by healing bonuses and without healing-trigger rewards. It preserves existing effects and spent per-battle counters and does not renew spent Death’s Door or grace. The recipient stays in its current formation position and regains ordinary ownership of its cards

## Play and balance

A normal opening uses Ward and redraws toward teammates’ useful cards. After a companion falls, Oathara can carry that creature’s abilities or spend Mana on Vow of Return. A borrowed self-protection card protects Oathara; resurrection returns future plays to the original creature without refunding the allowance already spent

Poor hands contain resurrection without a knockout or redraw without useful alternatives. At base tier only one fallen card can be played per turn. Spending allowances still requires available cards and Mana; higher tiers benefit from ordinary Mana and free-card support. Multi-hit attacks exhaust one ward, and periodic damage bypasses it. A support-only survivor may need to draw a fallen attacker’s card to finish the battle

Redraw intentionally overlaps Euphera’s selected hand exchange. Attack reflection can exceed a six-point defensive budget against a large attack, while resurrection typically restores about six Health and access to a creature’s passive. Neither ability adds unrelated utility. Duplicate guides, repeated resurrection and high-rank borrowing need hosted balance qualification; no measured balance claim is made

## Artwork and evidence

Unchanged sources from the [Oathara Drive folder](https://drive.google.com/drive/folders/1jRdwJ4l7OobGfEx5t_On5g65puOr5f5X) are preserved in `public/art/oathara/`. The [asset manifest](../../../assets/manifest.json) records all four source URLs, rights and lossless preparation recipes. The selected portrait, Never Lost, Traveler’s Ward and Vow of Return retain their native compositions

Focused regression coverage lives in [Oathara’s suite](../../../tests/unit/game/creatures/oathara.test.ts). Rendered review and platform qualification are separate from source inspection; current evidence and limitations are recorded with the implementation handoff

## Rendered review

Focused Chromium review on October 23, 2026 inspected Collection and creature inspection, all three ability illustrations and tooltips, base and five-star passive wording, battle and targeting at 1280×720 with 125% text and 1920×1080 with default text. Captures used reduced motion and 2× device density. The selected compositions remain uncropped, the rules and controls fit, and the shortened backup target label clears the portrait

The browser flow exercised keyboard card selection, targeting and cancellation, borrowed-card Mana payment and spent-allowance visibility, resurrection previews and the committed six-Health return, restored ownership after revival, attack-reflection consumption and turn reset. Separate flows exercised Never Lost and resurrection of a knocked-out backup. The retained task checkout holds captures, checkpoints, prior attempts and interaction results in `reports/oathara/evidence.json`; all recorded layout assertions passed

The focused game regression suite passed locally. Full compilers, broader unit/DOM suites, browser suites, measured balance, native desktop, Windows packaging, physical controllers, Steam client and Steam Deck remain unverified or CI-owned. Source artwork and the kit were user-selected; this rendered review does not establish separate artistic approval
