/** Scenario IDs become filenames, so replayed evidence must not escape or collide. */
export function validateReplayScenarios(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new Error("Invalid performance replay scenarios.");
  const ids = new Set();
  for (const row of cases) {
    const scenario = row?.scenario;
    if (
      !scenario ||
      typeof scenario.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(scenario.id) ||
      row.id !== scenario.id ||
      ids.has(scenario.id) ||
      typeof scenario.initial !== "string" ||
      !scenario.initial ||
      typeof scenario.fixture !== "string" ||
      !scenario.fixture ||
      !Array.isArray(scenario.actions) ||
      !scenario.actions.length
    )
      throw new Error("Invalid performance replay scenarios.");
    ids.add(scenario.id);
  }
}

/** Parse the complete command before loading evidence or starting a capture. */
export function parsePerformanceArgs(args) {
  if (["compare", "overhead", "replay"].includes(args[0])) {
    const mode = args[0];
    const min = mode === "replay" ? 2 : 3;
    if (
      args.length < min ||
      args.length > min + 1 ||
      args.slice(1).some((value) => !value || value.startsWith("--"))
    )
      throw new Error(`Invalid ${mode} arguments.`);
    return { mode, inputs: args.slice(1, min), output: args[min] };
  }
  const options = {
    mode: "capture",
    native: false,
    cold: false,
    traceMode: false,
    recordSpans: true,
    suite: "fixed",
    seed: 42,
  };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Duplicate performance option: ${flag}`);
    seen.add(flag);
    if (flag === "--electron") options.native = true;
    else if (flag === "--cold") options.cold = true;
    else if (flag === "--trace") options.traceMode = true;
    else if (["--scenario", "--out", "--suite", "--seed", "--spans"].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}.`);
      if (flag === "--scenario") options.scenarioId = value;
      if (flag === "--out") options.output = value;
      if (flag === "--suite") options.suite = value;
      if (flag === "--seed") {
        if (!/^\d+$/u.test(value)) throw new Error("Invalid performance seed.");
        options.seed = Number(value);
      }
      if (flag === "--spans") {
        if (!["on", "off"].includes(value)) throw new Error("Choose --spans on or off");
        options.recordSpans = value === "on";
      }
    } else throw new Error(`Invalid performance option: ${flag}`);
  }
  if (
    !Number.isSafeInteger(options.seed) ||
    options.seed > 0xffffffff ||
    !["fixed", "reachable"].includes(options.suite)
  )
    throw new Error("Invalid performance suite or seed.");
  if (
    options.cold &&
    (!options.native || options.suite !== "fixed" || (options.scenarioId && options.scenarioId !== "startup"))
  )
    throw new Error("Cold capture requires --electron and the fixed startup scenario.");
  if (options.cold) options.scenarioId = "startup";
  return options;
}
