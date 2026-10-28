import { temporaryDirectory, writeFixture } from "../../support/tooling.mjs";
import { it, expect } from "vitest";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { playerNote, generatePatchNotes, notesArgs } from "../../../scripts/release/generate-patch-notes.mjs";
import {
  buildIdentity,
  releaseVersion,
  verifyBuildIdentity,
  releaseIdentityPlugin,
} from "../../../scripts/lib/release-identity.mjs";
import {
  releaseArgs,
  verifyRelease,
  verifySteamConfiguration,
} from "../../../scripts/release/verify-release.mjs";
import { requireVerifiedCI } from "../../../scripts/release/require-ci.mjs";

it("blocks Steam releases with missing, development or invalid App IDs", async () => {
  await repository(async (root) => {
    mkdirSync(path.join(root, "desktop"));
    const file = path.join(root, "desktop/steam-config.json");
    for (const appId of [null, 0, -1, 480, "123456", 1.5, 0x100000000]) {
      writeFileSync(file, JSON.stringify({ appId }));
      await expect(verifySteamConfiguration(root)).rejects.toThrow("Fauna's own App ID");
    }
    writeFileSync(file, JSON.stringify({ appId: 123456 }));
    await expect(verifySteamConfiguration(root)).resolves.toBe(123456);
    await expect(verifyRelease(root, { versionOnly: true })).resolves.toMatchObject({ version: "1.0.0" });
  });
});

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
  const root = temporaryDirectory("fauna-release-");
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  writeFixture(
    root,
    "package.json",
    JSON.stringify({
      name: "fauna",
      version: "1.0.0",
      build: { appId: "com.fauna.game", productName: "Fauna" },
    }),
  );
  writeFixture(
    root,
    "package-lock.json",
    JSON.stringify({
      name: "fauna",
      version: "1.0.0",
      packages: { "": { name: "fauna", version: "1.0.0" } },
    }),
  );
  git("add", ".");
  git("commit", "-qm", "chore: initialize");
  return await test(root, git);
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
    writeFixture(root, "src/game/card.ts", "new boon");
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
    writeFixture(root, "unrelated", "other branch");
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
      null,
      { ...expected, dirty: undefined },
      { ...expected, dirty: null },
      { ...expected, dirty: 0 },
      { ...expected, dirty: true },
      { ...expected, commit: "old" },
      { ...expected, tree: "old" },
      { ...expected, version: "9.0.0" },
    ])
      expect(() => verifyBuildIdentity(record, expected)).toThrow("stale");
    const plugin = releaseIdentityPlugin(root);
    plugin.buildStart();
    writeFixture(root, "new-source", "changed during build");
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
    writeFixture(root, "package-lock.json", JSON.stringify(lock));
    expect(() => releaseVersion(root)).toThrow("lock");
  }));
it("fails release verification before package access when the tagged renderer is stale", () =>
  repository(async (root, git) => {
    mkdirSync(path.join(root, "dist"));
    writeFixture(root, ".gitignore", "dist/\n");
    git("add", ".gitignore");
    git("commit", "-qm", "chore: ignore build");
    git("tag", "v1.0.0");
    writeFixture(root, "dist/release.json", JSON.stringify({ ...buildIdentity(root), commit: "old" }));
    await expect(verifyRelease(root, { tag: "v1.0.0" })).rejects.toThrow("stale");
  }));

it("rejects whitespace in otherwise matching release versions", () =>
  repository((root) => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
    for (const version of ["1.0.0\n", "1.0.0\r", " 1.0.0"]) {
      pkg.version = lock.version = lock.packages[""].version = version;
      writeFixture(root, "package.json", JSON.stringify(pkg));
      writeFixture(root, "package-lock.json", JSON.stringify(lock));
      expect(() => releaseVersion(root)).toThrow("version");
    }
  }));

it("includes player-facing changes owned by application policy modules", () => {
  expect(playerNote("fix: preserve battle rewards", ["src/application/battle-benefits.ts"])).toEqual({
    section: "Fixes",
    text: "Preserve battle rewards",
  });
});

it("rejects matching but missing or malformed build provenance", () => {
  const identity = {
    format: 1,
    name: "fauna",
    version: "1.0.0",
    dirty: false,
    commit: "a".repeat(40),
    tree: "b".repeat(40),
  };
  for (const field of ["commit", "tree"]) {
    for (const value of [undefined, "", "HEAD", "a".repeat(39), "a".repeat(40) + "\n"]) {
      const malformed = { ...identity, [field]: value };
      expect(() => verifyBuildIdentity(malformed, malformed)).toThrow("stale");
    }
  }
});
