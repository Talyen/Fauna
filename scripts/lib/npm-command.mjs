import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

// Invoke npm's JavaScript entry point so Windows does not need a shell for npm.cmd.
export function npmCommand(args, env = process.env) {
  if (env.npm_execpath?.endsWith("npm-cli.js")) return [process.execPath, [env.npm_execpath, ...args]];
  for (const directory of (env.PATH ?? "").split(path.delimiter)) {
    for (const name of ["npm", "npm.cmd"]) {
      const launcher = path.join(directory, name);
      if (!existsSync(launcher)) continue;
      const resolved = realpathSync(launcher);
      if (resolved.endsWith("npm-cli.js")) return [process.execPath, [resolved, ...args]];
      const adjacent = path.join(path.dirname(resolved), "node_modules/npm/bin/npm-cli.js");
      if (existsSync(adjacent)) return [process.execPath, [adjacent, ...args]];
    }
  }
  throw new Error("Cannot locate npm-cli.js. Install npm or invoke through npm run.");
}
