import { expect, it, vi } from "vitest";
import { auditFindings } from "../../../scripts/checks/security-audit.mjs";
it("rejects advisories and incomplete audits", () => {
  const advisory = {
    name: "sprintf-js",
    severity: "moderate",
    title: "formatter",
    url: "https://github.com/advisories/GHSA-hp3w-g68c-fv3c",
  };
  const report = (entry) => ({
    metadata: { vulnerabilities: {} },
    vulnerabilities: { package: { via: [entry] } },
  });
  expect(auditFindings({ metadata: { vulnerabilities: {} }, vulnerabilities: {} }).rejected).toEqual([]);
  expect(auditFindings(report(advisory)).rejected).toHaveLength(1);
  expect(auditFindings(report({ ...advisory, url: "new" })).rejected).toHaveLength(1);
  expect(auditFindings(report({ ...advisory, severity: "high" })).rejected).toHaveLength(1);
  expect(() => auditFindings({ error: "offline" })).toThrow();
  expect(() => auditFindings(report("indirect-only"))).toThrow();
});

it("leaves CI suite and test execution unbounded without weakening audit checks", async () => {
  vi.stubEnv("CI", "true");
  try {
    vi.resetModules();
    const { default: vitest } = await import("../../../vitest.config.ts");
    const { default: playwright } = await import("../../../playwright.config.ts");
    expect(vitest.test.testTimeout).toBe(0);
    expect(vitest.test.hookTimeout).toBe(0);
    expect(playwright.timeout).toBe(0);
    expect(playwright.globalTimeout ?? 0).toBe(0);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

it("limits the reviewed legacy minimatch exception to the inspected development artifacts", () => {
  const advisory = {
    source: 1244012,
    name: "minimatch",
    title: "globparts amplification",
    severity: "moderate",
    range: "<11.0.1",
    url: "https://github.com/advisories/GHSA-g3hv-75wg-m249",
  };
  const node = "node_modules/legacy/node_modules/minimatch";
  const report = {
    metadata: { vulnerabilities: {} },
    vulnerabilities: { minimatch: { nodes: [node], via: [advisory] } },
  };
  const legacy = {
    version: "3.1.5",
    dev: true,
    integrity:
      "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==",
  };
  const lock = (pkg) => ({ packages: { [node]: pkg } });
  expect(auditFindings(report, lock(legacy))).toMatchObject({
    rejected: [],
    exceptions: [expect.any(String)],
  });
  for (const pkg of [
    { ...legacy, version: "9.0.9" },
    {
      ...legacy,
      version: "5.1.9",
      integrity:
        "sha512-7o1wEA2RyMP7Iu7GNba9vc0RWWGACJOCZBJX2GJWip0ikV+wcOsgVuY9uE8CPiyQhkGFSlhuSkZPavN7u1c2Fw==",
    },
    { ...legacy, integrity: "changed" },
    { ...legacy, version: "unknown", integrity: undefined },
    { ...legacy, dev: false },
    undefined,
  ])
    expect(auditFindings(report, lock(pkg)).rejected).toHaveLength(1);
  expect(
    auditFindings(
      { ...report, vulnerabilities: { minimatch: { nodes: [node], via: [{ ...advisory, source: 1 }] } } },
      lock(legacy),
    ).rejected,
  ).toHaveLength(1);
});
