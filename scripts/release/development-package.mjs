import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "../lib/git.mjs";
import {
  createDevelopmentRun,
  finishDevelopmentRun,
  pruneDevelopmentLocked,
  withDevelopmentLock,
} from "./development-retention.mjs";

export function developmentPackage(
  root,
  args,
  { env = process.env, runner = spawnSync, idle, graceMs } = {},
) {
  const builder = path.join(root, "node_modules/electron-builder/cli.js");
  // Hosted artifacts and signed candidates keep the established release paths.
  if (env.GITHUB_ACTIONS === "true")
    return runner(process.execPath, [builder, ...args], { cwd: root, env, stdio: "inherit" }).status ?? 1;
  return withDevelopmentLock(root, () => {
    const run = createDevelopmentRun(root, {
      commit: git(root, ["rev-parse", "HEAD"]).trim(),
      dirty: Boolean(git(root, ["status", "--porcelain", "--untracked-files=all"])),
    });
    const result = runner(process.execPath, [builder, ...args, `--config.directories.output=${run.output}`], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    // Unknown termination is not a completed failure: retain its owner and bytes.
    if (result.error || result.signal || result.status === null) {
      console.error(`Package outcome uncertain; retained ${run.entry}`);
      return result.status || 1;
    }
    const executable = lstatSync(path.join(run.output, "win-unpacked", "Fauna.exe"), {
      throwIfNoEntry: false,
    });
    const success = result.status === 0 && executable?.isFile() && !executable.isSymbolicLink();
    try {
      finishDevelopmentRun(run, success ? "success" : "failed");
      const report = pruneDevelopmentLocked(root, {
        dryRun: false,
        ...(idle ? { idle } : {}),
        ...(graceMs === undefined ? {} : { graceMs }),
      });
      console.log(
        `Development package ${success ? "ready" : "failed"}: ${run.entry}; removed ${report.candidates.length} eligible outputs.`,
      );
      for (const item of report.preserved) console.warn(`Preserved ${item.path}: ${item.reason}`);
    } catch (error) {
      console.error(`Package retained for review: ${run.entry}: ${error.message}`);
      return 1;
    }
    return success ? 0 : result.status || 1;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = developmentPackage(path.resolve(import.meta.dirname, "../.."), process.argv.slice(2));
