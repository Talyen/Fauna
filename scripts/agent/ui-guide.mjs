import path from "node:path";
import { pathToFileURL } from "node:url";
import { SCENARIOS } from "../dev/review-scenarios.mjs";

export function uiGuide(tier, scenario) {
  if (!["small", "interaction", "layout"].includes(tier))
    throw new Error("Choose small, interaction or layout; see Docs/UI.md#required-review.");
  if (!SCENARIOS.includes(scenario)) throw new Error(`Choose a scenario: ${SCENARIOS.join(", ")}.`);
  const capture = (label) => `npm run capture:task -- --scenario ${scenario} --tier ${tier} --label ${label}`;
  return [
    `UI review: ${tier}; scenario ${scenario}`,
    tier === "layout"
      ? "Inspect the current rendered flow and relevant references before editing."
      : "Capture the changed screen after editing.",
    ...(tier === "layout" ? [`Before: ${capture("before")}`] : []),
    `After: ${capture("after")}`,
    tier === "layout"
      ? "Conditions: 1280x720 at 125% text and 1920x1080 at default text."
      : "Conditions: 1280x720 at 125% text.",
    "Inspect whole frames for composition, copy, artwork, contrast, fit and focus; capture alone does not approve appearance.",
    "Exercise the changed action, cancellation, focus return and unavailable state where applicable; record outcomes and limitations.",
    tier === "layout"
      ? "Match before/after checkpoints and conditions; use the shared host lane for rendered inspection as documented in CONTRIBUTING.md."
      : "A baseline is optional if geometry and behavior are unchanged; use the shared host lane for rendered inspection as documented in CONTRIBUTING.md.",
    "Status: captures, image inspection and interactions have not been performed by this guide.",
  ].join("\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 4)
    throw new Error("Usage: npm run ui:guide -- <small|interaction|layout> <scenario>");
  console.log(uiGuide(process.argv[2], process.argv[3]));
}
