# Uncertainty-aware previews and hitch attribution

## Scope

Implemented the [performance attribution plan](../PERFORMANCE_ATTRIBUTION_PLAN.md) and bounded correlated card forecasts through the existing combat resolver. No save-format change, live RNG change, gameplay balance change or measured performance improvement is claimed.

## Verification boundaries

- Focused local regression: `tests/unit/ui/uncertain-preview-attribution.test.tsx`, one worker, within the 30-second budget; fourteen tests passed
- Lightweight source/documentation gate and final protected integration are required before local completion
- Focused Vite Chromium interaction review at 1280×720, 125% text and reduced motion passed: target changes and cancellation preserve saved state/RNG, focus returns to the card, committed results match the production dispatcher, and unavailable Mana retains its reason without a forecast or save mutation
- Interaction evidence: task-owned `reports/uncertainty-interactions/evidence.json`; selected-state screenshots beside it
- Normal-motion interaction evidence: `reports/uncertainty-interactions-normal/evidence.json`; both chance and hidden-draw plays matched dispatch, with pause interruption and unchanged committed saves after resume
- Matching baseline UI captures: `reports/review/uncertainty-before-659537d6-350a-4b67-aea6-1502043cc906/`, restoring only the task base's battle screen, forecast component and battle stylesheet temporarily; current sources were restored before candidate captures
- Final chance captures: `reports/review/uncertainty-final-27b4605e-9474-4c2a-8b12-d895a14134de/`, 1280×720 at 125% text and 1920×1080 at default text; hidden information: `reports/review/uncertainty-hidden-final-ef2904ca-0a3a-4d61-bee9-6e6aef5b6b61/`
- After recorder ownership hardening, fresh minimum-viewport evidence: `reports/review/uncertainty-recorder-final-10363ecf-b28c-4f6d-a5f1-0ad79883fa18/`
- An initial capture under `reports/review/uncertain-preview-25c95550-d741-427e-b103-355b334b7cc7/` established fit but exposed excessive wrapping after a later copy refinement; final captures supersede that candidate
- Full CI, compilers, builds, broad browser suites, real performance and recorder-overhead captures, runtime CDP tracing, native Electron, Windows packaging, physical controllers, Steam client and Steam Deck remain unrun locally

The optional weekly/manual workflow now exercises the synthetic stall, ordinary/React Compiler observations, and a recording-overhead pair. Deep tracing remains an explicit manual workflow input. These are implemented future execution paths, not completed hosted evidence.

## Rendered review

Conditional readouts retain concise chance/knockout labels and authored rules. Exact guaranteed values retain the existing readout. Complex forecasts do not show a sampled or truncated result as definite. Final review checks artwork scale, readout wrapping, contrast, target cancellation/focus and committed outcomes; no artistic approval is inferred from agent inspection.
