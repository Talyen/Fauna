import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { npmCommand } from "../lib/npm-command.mjs";
// Latest stable electron-builder still uses this formatter in its download proxy logger.
// No player-supplied format strings reach it. Reassess upstream rather than forcing a major override.
const EXCEPTIONS = new Map([["https://github.com/advisories/GHSA-hp3w-g68c-fv3c", "2026-11-21T00:00:00Z"]]);
export function auditFindings(audit, now = Date.now()) {
  if (audit.error || !audit.metadata?.vulnerabilities || !audit.vulnerabilities)
    throw new Error("Dependency audit did not return complete results.");
  const rejected = [];
  const accepted = new Set();
  for (const entry of Object.values(audit.vulnerabilities))
    for (const advisory of entry.via) {
      if (typeof advisory === "string") continue; // The referenced package is checked separately.
      const expiry = EXCEPTIONS.get(advisory.url);
      if (
        expiry &&
        now < Date.parse(expiry) &&
        advisory.name === "sprintf-js" &&
        advisory.severity === "moderate"
      )
        accepted.add(advisory.url);
      else rejected.push(`${advisory.name}: ${advisory.title} (${advisory.severity})`);
    }
  if (Object.keys(audit.vulnerabilities).length && !accepted.size && !rejected.length)
    throw new Error("Dependency audit contains no advisory details.");
  return { rejected, accepted: [...accepted] };
}
function main() {
  const [command, args] = npmCommand(["audit", "--package-lock-only", "--json", "--ignore-scripts"]);
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 60_000, maxBuffer: 4_000_000 });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("Dependency audit could not finish.");
  const report = JSON.parse(result.stdout);
  const findings = auditFindings(report);
  mkdirSync("reports/security", { recursive: true });
  writeFileSync("reports/security/audit.json", JSON.stringify({ audit: report, ...findings }, null, 2));
  console.log(
    `${findings.rejected.length} unaccepted advisories; ${findings.accepted.length} temporary build-tool exception`,
  );
  for (const message of findings.rejected) console.error(message);
  if (findings.rejected.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
