import { temporaryDirectory, writeFixture } from "../../support/tooling.mjs";
import { expect, it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { restoreVercelConfig } from "../../../scripts/release/vercel-build.mjs";

it("restores only Vercel's equivalent JSON formatting while preserving meaningful or local edits", () => {
  const root = temporaryDirectory("fauna-vercel-build-");
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const file = path.join(root, "vercel.json");
  const config = { buildCommand: "npm run build", git: { deploymentEnabled: false } };
  const committed = JSON.stringify(config, null, 2) + "\n";

  git("init", "-qb", "main");
  git("config", "user.name", "Build fixture");
  git("config", "user.email", "fixture@example.invalid");
  writeFileSync(file, committed);
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "base");
  writeFileSync(file, JSON.stringify(config));
  expect(() => restoreVercelConfig(root, {})).toThrow("only for hosted Vercel");
  expect(readFileSync(file, "utf8")).toBe(JSON.stringify(config));
  restoreVercelConfig(root, { VERCEL: "1" });
  expect(readFileSync(file, "utf8")).toBe(committed);
  writeFixture(root, "game.ts", "uncommitted source");
  restoreVercelConfig(root, { VERCEL: "1" });
  expect(git("status", "--porcelain").toString()).toContain("game.ts");
  for (const changed of [
    { ...config, git: { deploymentEnabled: true } },
    { ...config, buildCommand: "npm run  build" },
  ]) {
    const text = JSON.stringify(changed);
    writeFileSync(file, text);
    expect(() => restoreVercelConfig(root, { VERCEL: "1" })).toThrow("differs from the committed");
    expect(readFileSync(file, "utf8")).toBe(text);
  }
});
