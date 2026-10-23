import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { playerNote, generatePatchNotes, notesArgs } from "../../../scripts/release/generate-patch-notes.mjs";
import {
  buildIdentity,
  releaseVersion,
  verifyBuildIdentity,
  releaseIdentityPlugin,
} from "../../../scripts/lib/release-identity.mjs";
import { releaseArgs, verifyRelease } from "../../../scripts/release/verify-release.mjs";
import { requireVerifiedCI } from "../../../scripts/release/require-ci.mjs";

it("requires the exact commit's successful final CI gate, excluding suppressed duplicate runs", () => {
  const commit = "a".repeat(40);
  const run = { databaseId: 123, headSha: commit, conclusion: "success", attempt: 2 };
  const complete = {
    ...run,
    jobs: [{ name: "verify", status: "completed", conclusion: "success" }],
    url: "https://example.invalid/run/123/attempts/2",
  };
  const check = (detail, runs = [run]) =>
    requireVerifiedCI(commit, {
      repository: "owner/fauna",
      runner: (_command, args) => JSON.stringify(args[1] === "list" ? runs : detail),
    });
  expect(check(complete)).toEqual(complete);
  for (const detail of [
    { ...complete, jobs: [] },
    { ...complete, jobs: [{ name: "verify", status: "completed", conclusion: "skipped" }] },
    { ...complete, jobs: [{ name: "verify", status: "completed", conclusion: "failure" }] },
    { ...complete, jobs: [{ name: "verify", status: "in_progress", conclusion: null }] },
    { ...complete, jobs: [...complete.jobs, ...complete.jobs] },
    { ...complete, headSha: "b".repeat(40) },
    { ...complete, attempt: 3 },
    { ...complete, conclusion: "failure" },
  ])
    expect(() => check(detail)).toThrow("successful full CI");
  expect(() => check(complete, [])).toThrow("successful full CI");
  expect(() => check(complete, [{ ...run, headSha: "b".repeat(40) }])).toThrow("successful full CI");
  expect(() =>
    requireVerifiedCI(commit, {
      repository: "owner/fauna",
      runner: () => {
        throw new Error("GitHub unavailable");
      },
    }),
  ).toThrow("GitHub unavailable");
  expect(() => requireVerifiedCI("branch", { repository: "owner/fauna" })).toThrow("full release commit");
});
async function repository(test) {
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-release-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  try {
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "fauna",
        version: "1.0.0",
        build: { appId: "com.fauna.game", productName: "Fauna" },
      }),
    );
    writeFileSync(
      path.join(root, "package-lock.json"),
      JSON.stringify({
        name: "fauna",
        version: "1.0.0",
        packages: { "": { name: "fauna", version: "1.0.0" } },
      }),
    );
    git("add", ".");
    git("commit", "-qm", "chore: initialize");
    return await test(root, git);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
it("filters infrastructure notes and honors explicit player wording and visibility", () => {
  expect(playerNote("feat: add tools", ["scripts/tool.mjs"])).toBeNull();
  expect(playerNote("fix: internal detail\n\nUser-Facing: no", ["src/game/engine.ts"])).toBeNull();
  expect(
    playerNote("fix: internal detail\n\nPlayer-Note: Swapping creatures preserves Burn bonuses.", [
      "src/game/engine.ts",
    ]),
  ).toEqual({ section: "Fixes", text: "Swapping creatures preserves Burn bonuses." });
  expect(playerNote("chore: metadata\n\nPlayer-Note: New language available.", [])).toMatchObject({
    section: "Changes",
  });
  expect(
    playerNote("chore: make controls easier to read\n\nUser-Facing: yes", ["scripts/tool.mjs"]),
  ).toMatchObject({ section: "Changes" });
  expect(playerNote("perf: capture timings", ["src/tooling/performance.ts"])).toBeNull();
  expect(() => notesArgs(["--publish"])).toThrow();
  expect(() => notesArgs(["--tag", "../../escape"])).toThrow();
});
it("uses reachable release ancestry and leaves Git unchanged when generating notes", () =>
  repository((root, git) => {
    git("tag", "v0.9.0");
    mkdirSync(path.join(root, "src/game"), { recursive: true });
    writeFileSync(path.join(root, "src/game/card.ts"), "new boon");
    git("add", ".");
    git("commit", "-qm", "feat(boons): add Meteorite\n\nPlayer-Note: Meteorite doubles your first Burn hit.");
    git("tag", "v1.0.0");
    const status = git("status", "--porcelain");
    const result = generatePatchNotes(root, { tag: "v1.0.0" });
    expect(result.base).toBe("v0.9.0");
    expect(result.markdown).toContain("Meteorite doubles your first Burn hit.");
    expect(result.markdown).not.toContain("initialize");
    expect(generatePatchNotes(root).markdown).toContain("No player-facing changes");
    // A branch named like a release tag must not change the selected history.
    git("branch", "v0.9.0", "HEAD");
    expect(generatePatchNotes(root, { tag: "v1.0.0" }).markdown).toBe(result.markdown);
    git("checkout", "-qb", "unrelated", "refs/tags/v0.9.0");
    writeFileSync(path.join(root, "unrelated"), "other branch");
    git("add", ".");
    git("commit", "-qm", "feat: unrelated");
    git("tag", "v9.0.0");
    git("checkout", "-q", "v1.0.0");
    expect(generatePatchNotes(root, { tag: "v1.0.0" }).markdown).toBe(result.markdown);
    expect(git("status", "--porcelain")).toBe(status);
  }));
it("rejects version, tag, source and dirty-build mismatches and records build races", () =>
  repository((root) => {
    expect(releaseVersion(root, "v1.0.0")).toBe("1.0.0");
    expect(() => releaseVersion(root, "v2.0.0")).toThrow("tag");
    const expected = buildIdentity(root);
    expect(() => verifyBuildIdentity(expected, expected)).not.toThrow();
    for (const record of [
      { ...expected, dirty: true },
      { ...expected, commit: "old" },
      { ...expected, tree: "old" },
      { ...expected, version: "9.0.0" },
    ])
      expect(() => verifyBuildIdentity(record, expected)).toThrow("stale");
    const plugin = releaseIdentityPlugin(root);
    plugin.buildStart();
    writeFileSync(path.join(root, "new-source"), "changed during build");
    let asset;
    plugin.generateBundle.call({
      emitFile(value) {
        asset = value;
      },
    });
    expect(JSON.parse(asset.source).dirty).toBe(true);
    expect(() => releaseArgs(["--push"], {})).toThrow();
    expect(() => releaseArgs([], {})).toThrow("requires");
    const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json")));
    lock.packages[""].version = "2.0.0";
    writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock));
    expect(() => releaseVersion(root)).toThrow("lock");
  }));
it("fails release verification before package access when the tagged renderer is stale", () =>
  repository(async (root, git) => {
    mkdirSync(path.join(root, "dist"));
    writeFileSync(path.join(root, ".gitignore"), "dist/\n");
    git("add", ".gitignore");
    git("commit", "-qm", "chore: ignore build");
    git("tag", "v1.0.0");
    writeFileSync(
      path.join(root, "dist/release.json"),
      JSON.stringify({ ...buildIdentity(root), commit: "old" }),
    );
    await expect(verifyRelease(root, { tag: "v1.0.0" })).rejects.toThrow("stale");
  }));
