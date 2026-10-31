import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { npmCommand } from "../lib/npm-command.mjs";
// These legacy releases do not contain the optimization described by GHSA-g3hv-75wg-m249.
// Their callers require the old callable CommonJS API. Match exact artifact hashes so a
// changed lockfile or different advisory fails closed until independently reviewed.
const legacyMinimatch = new Map([
  [
    "3.1.5",
    "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==",
  ],
]);
function legacyOptimizationException(entry, advisory, lock) {
  return (
    advisory.source === 1244012 &&
    advisory.name === "minimatch" &&
    advisory.severity === "moderate" &&
    advisory.range === "<11.0.1" &&
    advisory.url === "https://github.com/advisories/GHSA-g3hv-75wg-m249" &&
    Array.isArray(entry.nodes) &&
    entry.nodes.length > 0 &&
    entry.nodes.every((node) => {
      const pkg = lock?.packages?.[node];
      const integrity = legacyMinimatch.get(pkg?.version);
      return (
        node.endsWith("/minimatch") &&
        pkg?.dev === true &&
        integrity !== undefined &&
        integrity === pkg.integrity
      );
    })
  );
}
export function auditFindings(audit, lock) {
  if (audit.error || !audit.metadata?.vulnerabilities || !audit.vulnerabilities)
    throw new Error("Dependency audit did not return complete results.");
  const rejected = [];
  const exceptions = [];
  for (const entry of Object.values(audit.vulnerabilities))
    for (const advisory of entry.via) {
      if (typeof advisory === "string") continue; // The referenced package is checked separately.
      const message = `${advisory.name}: ${advisory.title} (${advisory.severity})`;
      if (legacyOptimizationException(entry, advisory, lock)) exceptions.push(message);
      else rejected.push(message);
    }
  if (Object.keys(audit.vulnerabilities).length && !rejected.length && !exceptions.length)
    throw new Error("Dependency audit contains no advisory details.");
  return { rejected, exceptions };
}
function main() {
  const [command, args] = npmCommand(["audit", "--package-lock-only", "--json", "--ignore-scripts"]);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: process.env.CI ? 0 : 60_000,
    maxBuffer: 4_000_000,
  });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("Dependency audit could not finish.");
  const report = JSON.parse(result.stdout);
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const findings = auditFindings(report, lock);
  mkdirSync("reports/security", { recursive: true });
  writeFileSync("reports/security/audit.json", JSON.stringify({ audit: report, ...findings }, null, 2));
  console.log(
    `${findings.rejected.length} rejected advisories; ${findings.exceptions.length} reviewed exceptions`,
  );
  for (const message of findings.exceptions) console.log(`Reviewed legacy exception: ${message}`);
  for (const message of findings.rejected) console.error(message);
  if (findings.rejected.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
