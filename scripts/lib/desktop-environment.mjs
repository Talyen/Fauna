// Each verification launch owns its profile and tests the built renderer.
export function isolatedDesktopEnvironment(profile, inherited = process.env) {
  const env = { ...inherited, FAUNA_SMOKE_USER_DATA: profile, FAUNA_DISABLE_STEAM: "1" };
  for (const key of [
    "ELECTRON_RUN_AS_NODE",
    "FAUNA_DEV_URL",
    "FAUNA_PREVIEW_USER_DATA",
    "FAUNA_PERF_CAPTURE",
  ])
    delete env[key];
  return env;
}

export function previewDesktopEnvironment(profile, url, inherited = process.env) {
  const env = isolatedDesktopEnvironment(profile, inherited);
  delete env.FAUNA_SMOKE_USER_DATA;
  return { ...env, FAUNA_PREVIEW_USER_DATA: profile, FAUNA_DEV_URL: url };
}
