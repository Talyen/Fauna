import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { compareBalance, pairedStats } from "../../scripts/lib/paired-balance.mjs";
import { summarizeSample, comparePerformance } from "../../scripts/lib/performance-metrics.mjs";
import {
  verifyArchive,
  verifyPE,
  rendererPath,
  verifyWindowsIdentity,
} from "../../scripts/verify-package.mjs";
import { review } from "../../scripts/agent-review.mjs";
import { context, sections } from "../../scripts/agent-context.mjs";
it("pairs matched samples, reports uncertainty and refuses incomplete or mismatched evidence", () => {
  expect(pairedStats([0, 1, -1])).toMatchObject({ mean: 0, noisy: true, n: 3 });
  expect(pairedStats([2, 2])).toMatchObject({ mean: 2, standardError: 0, noisy: false });
  expect(pairedStats([1]).standardError).toBeNull();
  const metrics = { win: 0, turns: 4, health: 10, encounter: 1, swaps: 1, currency: 20, xp: 3 };
  const base = {
    format: 1,
    complete: true,
    kind: "career",
    settings: {},
    identity: "old",
    cases: [
      { key: "seed", complete: true, initialHash: "same", baseHash: "same", metrics, evidence: "journal" },
    ],
  };
  const changed = structuredClone(base);
  changed.identity = "new";
  changed.cases[0].metrics.health = 12;
  expect(compareBalance(base, changed).metrics.health.mean).toBe(2);
  changed.cases[0].complete = false;
  expect(() => compareBalance(base, changed)).toThrow();
  changed.cases[0].complete = true;
  changed.cases[0].initialHash = "different";
  expect(() => compareBalance(base, changed)).toThrow();
});
it("rejects empty performance segments and incompatible replays", () => {
  const sample = {
    frames: Array(80).fill(16.7),
    segments: [{ complete: true, duration: 1400, frames: 80 }],
    longTasks: null,
    input: null,
  };
  expect(summarizeSample(sample).longTasks).toBeNull();
  expect(() => summarizeSample({ ...sample, frames: [16] })).toThrow();
  expect(() =>
    summarizeSample({ ...sample, segments: [{ complete: true, duration: 10, frames: 0 }] }),
  ).toThrow();
  const report = {
    format: 1,
    complete: true,
    environment: { viewport: 1280 },
    cases: [{ id: "battle", checkpointHash: "a", actionHash: "b", fixture: "v1", sample }],
  };
  expect(comparePerformance(report, report)[0].p95Delta).toBe(0);
  expect(() => comparePerformance(report, { ...report, environment: { viewport: 1920 } })).toThrow();
});
it("rejects broken Windows headers, escaping resources and corrupt packaged media", () => {
  const identity = { version: "1.2.3", build: { productName: "Fauna" } };
  expect(() =>
    verifyWindowsIdentity({ ProductName: "Fauna", ProductVersion: "1.2.3.0" }, identity),
  ).not.toThrow();
  expect(() =>
    verifyWindowsIdentity({ ProductName: "Alchemy", ProductVersion: "1.2.3.0" }, identity),
  ).toThrow();
  expect(() =>
    verifyWindowsIdentity({ ProductName: "Fauna", ProductVersion: "1.2.4.0" }, identity),
  ).toThrow();
  const pe = Buffer.alloc(100);
  pe.write("MZ");
  pe.writeUInt32LE(64, 60);
  pe.write("PE\0\0", 64);
  pe.writeUInt16LE(0x8664, 68);
  expect(() => verifyPE(pe)).not.toThrow();
  pe.writeUInt16LE(0x14c, 68);
  expect(() => verifyPE(pe)).toThrow();
  for (const ref of [
    "../a",
    "/a",
    "https://example.com/a",
    "%2e%2e/a",
    "%2fabs",
    "%68ttps%3a/example.com/a",
    "a\\b",
    "//server/a",
  ])
    expect(() => rendererPath(ref)).toThrow();
  const main = Buffer.from(
    "sandbox: true contextIsolation: true nodeIntegration: false app.isPackaged ? undefined",
  );
  const entries = {
    "package.json": Buffer.from(JSON.stringify({ name: "fauna", version: "1.0", main: "desktop/main.cjs" })),
    "desktop/main.cjs": main,
    "dist/index.html": Buffer.from('<script src="./app.js"></script>'),
    "dist/app.js": Buffer.from("production"),
    "dist/prepared/art.svg": Buffer.from("image"),
  };
  const options = {
    expected: { version: "1.0" },
    desktopFiles: { "desktop/main.cjs": main },
    receipt: {
      records: {
        image: { url: "./prepared/art.svg", outputHash: createHash("sha256").update("image").digest("hex") },
      },
    },
  };
  const read = (name) => entries[name];
  expect(verifyArchive(read, options).media).toBe(1);
  expect(() => verifyArchive(read, { ...options, releaseTag: "v2" })).toThrow();
  expect(() =>
    verifyArchive(read, { ...options, rendererFiles: { "dist/app.js": Buffer.from("different") } }),
  ).toThrow("renderer differs");
  entries["dist/prepared/art.svg"] = Buffer.from("corrupt");
  expect(() => verifyArchive(read, options)).toThrow();
  entries["dist/app.js"] = Buffer.from("Skip combat");
  expect(() => verifyArchive(read, options)).toThrow();
});
it("keeps complete patch evidence for unusual filenames without staging or losing staged changes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-review-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  try {
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    writeFileSync(path.join(root, "tracked"), "base\n");
    git("add", "tracked");
    git("commit", "-qm", "baseline");
    writeFileSync(path.join(root, "tracked"), "staged\n");
    git("add", "tracked");
    writeFileSync(path.join(root, "tracked"), "unstaged\n");
    const unusual = "odd ' $() [file]\n.txt";
    writeFileSync(path.join(root, unusual), "new content\n");
    writeFileSync(path.join(root, "invalid-utf8.bin"), Buffer.from([255, 254, 253]));
    const indexBefore = git("diff", "--cached");
    const result = review(root, [], { budget: 30 });
    expect(result.omittedCharacters).toBeGreaterThan(0);
    const full = readFileSync(result.patches, "utf8");
    expect(full).toContain("+staged");
    expect(full).toContain("+unstaged");
    expect(full).toContain("new content");
    expect(full).toContain("Binary file: 3 bytes");
    const lines = full.split("\n");
    for (const entry of result.selected) expect(lines[entry.start - 1]).toContain(JSON.stringify(entry.file));
    expect(git("diff", "--cached")).toBe(indexBefore);
    expect(result.inventory.some((entry) => entry.file === unusual)).toBe(true);
    mkdirSync(path.join(root, "Docs"));
    writeFileSync(path.join(root, "Docs/ARCHITECTURE.md"), "# Architecture\n\n## Commands\ntext\n");
    expect(context(root, ["unknown"]).topics).toEqual(["architecture"]);
    expect(sections(root, "Docs/ARCHITECTURE.md")[1]).toMatchObject({ start: 3, end: 5 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
