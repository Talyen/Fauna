import { SCENARIOS } from "./review-scenarios.mjs";

export function reviewOptions(args, { capture = false } = {}) {
  const options = {
    scenario: capture ? "battle" : null,
    viewport: { width: 1280, height: 720 },
    scale: 1.25,
    tier: "layout",
    label: "candidate",
    mode: null,
  };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(arg);
    if (!capture && ["--browser", "--desktop"].includes(arg)) {
      if (options.mode) throw new Error("Choose browser or desktop.");
      options.mode = arg.slice(2);
      continue;
    }
    if (
      !["--scenario", "--viewport", "--text-scale", ...(capture ? ["--tier", "--label"] : [])].includes(arg)
    )
      throw new Error(`Unknown review option: ${arg}`);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
    if (arg === "--scenario") options.scenario = value;
    if (arg === "--label") options.label = value;
    if (arg === "--tier") options.tier = value;
    if (arg === "--text-scale") options.scale = Number(value);
    if (arg === "--viewport") {
      const match = /^(\d+)x(\d+)$/.exec(value);
      if (!match) throw new Error("Use --viewport WIDTHxHEIGHT.");
      options.viewport = { width: Number(match[1]), height: Number(match[2]) };
    }
  }
  if (options.scenario && !SCENARIOS.includes(options.scenario))
    throw new Error(`Choose a scenario: ${SCENARIOS.join(", ")}.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.label))
    throw new Error("Use a lowercase capture label with single hyphens.");
  if (!["small", "interaction", "layout"].includes(options.tier))
    throw new Error("Choose --tier small, interaction or layout.");
  if (![1, 1.25].includes(options.scale)) throw new Error("Text scale must be 1 or 1.25.");
  if (
    options.viewport.width < 1280 ||
    options.viewport.height < 720 ||
    options.viewport.width > 3840 ||
    options.viewport.height > 2160
  )
    throw new Error("Review viewports must be between 1280x720 and 3840x2160.");
  const custom = seen.has("--viewport") || seen.has("--text-scale");
  if (!capture && (options.scenario || custom) && options.mode !== "browser")
    throw new Error("Scenario, viewport and text options require --browser.");
  if (capture && custom && seen.has("--tier"))
    throw new Error("Choose a review tier or custom viewport/text conditions.");
  options.conditions =
    capture && !custom && options.tier === "layout"
      ? [
          { width: 1280, height: 720, scale: 1.25 },
          { width: 1920, height: 1080, scale: 1 },
        ]
      : [{ ...options.viewport, scale: options.scale }];
  if (capture && custom) options.tier = "custom";
  return options;
}
