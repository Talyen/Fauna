import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { reportDirectory } from "../lib/tool-runtime.mjs";
import { rankBalanceFindings, findingsMarkdown } from "./findings.mjs";
export async function writeBalanceFindings(report, directory) {
  const result = rankBalanceFindings(report);
  await writeFile(path.join(directory, "findings.json"), JSON.stringify(result, null, 2) + "\n");
  await writeFile(path.join(directory, "findings.md"), findingsMarkdown(result));
  console.log(`Balance findings: ${result.findings.length}; ${path.join(directory, "findings.md")}`);
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2 || args.some((arg) => arg.startsWith("-")))
    throw new Error("Usage: balance:findings -- report.json [reports/output-directory]");
  const report = JSON.parse(await readFile(path.resolve(args[0]), "utf8"));
  const directory = await reportDirectory(args[1], `reports/balance/findings-${Date.now()}`);
  await writeBalanceFindings(report, directory);
}
