import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function parseInteractionArgs(args) {
  const options = { seed: 42, steps: 24, family: "mixed" };
  const seen = new Set();
  const allowed = new Set(["seed", "steps", "family", "replay", "out", "shrink"]);
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    const key = flag?.startsWith("--") ? flag.slice(2) : "";
    if (!allowed.has(key) || !value || value.startsWith("--") || seen.has(key))
      throw new Error(`Invalid or duplicate interaction option: ${flag}`);
    seen.add(key);
    if (["seed", "steps"].includes(key) && !/^\d+$/u.test(value))
      throw new Error("Invalid interaction configuration.");
    options[key] = ["seed", "steps"].includes(key) ? Number(value) : value;
  }
  if (
    !Number.isSafeInteger(options.seed) ||
    options.seed < 0 ||
    options.seed > 0xffffffff ||
    !Number.isSafeInteger(options.steps) ||
    options.steps < 1 ||
    options.steps > 100 ||
    !["mixed", "navigation", "battle", "persistence"].includes(options.family) ||
    (options.shrink !== undefined && !["true", "false"].includes(options.shrink))
  )
    throw new Error("Invalid interaction configuration.");
  if (seen.has("replay") && ["seed", "steps", "family"].some((key) => seen.has(key)))
    throw new Error("Replay cannot be combined with seed, steps or family options.");
  return options;
}

/** The initial exclusive report reserves an empty directory and survives startup failure. */
export async function reserveInteractionReport(directory, report) {
  if ((await readdir(directory)).length)
    throw new Error("Choose an empty interaction output directory; existing evidence is preserved.");
  try {
    await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("Choose an empty interaction output directory; existing evidence is preserved.");
    throw error;
  }
}

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
    !report.initial ||
    typeof report.identity !== "string" ||
    !report.identity ||
    typeof report.complete !== "boolean" ||
    (report.checkpointMode !== undefined && report.checkpointMode !== "recompute") ||
    !Array.isArray(report.actions) ||
    !report.actions.length ||
    report.actions.length > 100
  )
    throw new Error("Invalid interaction replay report.");
  for (const [index, action] of report.actions.entries()) {
    if (!action || !["collection", "settings", "talents", "battle", "reload"].includes(action.kind))
      throw new Error("Invalid interaction action.");
    if (action.kind === "battle" && !action.command) throw new Error("Missing replay command.");
    const hasHash =
      typeof action.checkpointHash === "string" && /^[a-f0-9]{64}$/u.test(action.checkpointHash);
    const failedAttempt = !report.complete && index === report.actions.length - 1;
    if (
      (!hasHash && action.checkpointHash !== undefined) ||
      (!hasHash && report.checkpointMode !== "recompute" && !failedAttempt)
    )
      throw new Error("Missing or invalid interaction checkpoint hash.");
  }
  return report;
}
