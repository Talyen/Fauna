import { expect, it } from "vitest";
import { auditFindings } from "../../../scripts/checks/security-audit.mjs";
it("rejects new advisories, incomplete audits and expired build-tool exceptions", () => {
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
  expect(auditFindings(report(advisory), Date.parse("2026-10-21")).accepted).toEqual([advisory.url]);
  expect(auditFindings(report(advisory), Date.parse("2026-11-21")).rejected).toHaveLength(1);
  expect(auditFindings(report({ ...advisory, url: "new" })).rejected).toHaveLength(1);
  expect(auditFindings(report({ ...advisory, severity: "high" })).rejected).toHaveLength(1);
  expect(() => auditFindings({ error: "offline" })).toThrow();
});
