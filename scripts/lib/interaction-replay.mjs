// Candidate replays must use a new profile and recompute their command checkpoints.
// An inapplicable command is not evidence of the original failure.
export async function shrinkTrace(
  actions,
  failure,
  replay,
  { attempts = 40, deadlineMs = 30000, now = Date.now } = {},
) {
  let minimal = [...actions],
    tried = 0,
    width = Math.ceil(minimal.length / 2);
  const deadline = now() + deadlineMs;
  while (width >= 1 && tried < attempts && now() < deadline) {
    let reduced = false;
    for (let start = 0; start < minimal.length && tried < attempts && now() < deadline; start += width) {
      const candidate = minimal.slice(0, start).concat(minimal.slice(start + width));
      if (!candidate.length) continue;
      tried++;
      const result = await replay(candidate);
      if (result.valid && result.failure === failure) {
        minimal = candidate;
        reduced = true;
        break;
      }
    }
    if (!reduced) width = Math.floor(width / 2);
  }
  return { actions: minimal, attempts: tried, bounded: tried >= attempts || now() >= deadline };
}
export function validateInteractionReport(report) {
  if (
    report?.format !== 1 ||
    !Number.isInteger(report.seed) ||
    report.seed < 0 ||
    report.seed > 0xffffffff ||
    typeof report.initial !== "string" ||
    typeof report.identity !== "string" ||
    !Array.isArray(report.actions) ||
    !report.actions.length ||
    report.actions.length > 100
  )
    throw new Error("Invalid interaction replay report.");
  for (const action of report.actions) {
    if (!["collection", "settings", "talents", "battle", "reload"].includes(action.kind))
      throw new Error("Invalid interaction action.");
    if (action.kind === "battle" && !action.command) throw new Error("Missing replay command.");
  }
  return report;
}
