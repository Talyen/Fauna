import { expect, it } from "vitest";
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
