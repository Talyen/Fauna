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
