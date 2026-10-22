import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { worker } from "../../../scripts/balance/balance-compare.mjs";
import { compareBalance, pairedStats } from "../../../scripts/lib/paired-balance.mjs";
import { summarizeSample, comparePerformance } from "../../../scripts/lib/performance-metrics.mjs";
import {
  verifyArchive,
  verifyWindowsRuntime,
  WINDOWS_RUNTIME_FILES,
  verifyPE,
  rendererPath,
  verifyWindowsIdentity,
} from "../../../scripts/release/verify-package.mjs";
import { review } from "../../../scripts/agent/agent-review.mjs";
import { context, sections } from "../../../scripts/agent/agent-context.mjs";
import { performanceBuildIdentity } from "../../../scripts/performance/run-performance.mjs";
import { isolatedDesktopEnvironment } from "../../../scripts/lib/desktop-environment.mjs";

it("finds gameplay and presentation owners from current modules and focused suites", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  for (const file of [
    "src/game/abilities.ts",
    "src/game/ability-values.ts",
    "src/game/card-zones.ts",
    "src/game/random.ts",
    "tests/unit/game/combat.test.ts",
  ])
    expect(context(root, [file]).topics).toContain("combat");
  expect(context(root, ["src/game/support.ts"]).topics).toContain("progression");
  const collection = context(root, ["tests/unit/ui/collection-ui.test.tsx"]);
  expect(collection.topics).toEqual(expect.arrayContaining(["ui", "progression", "tooling"]));
  expect(collection.entries).toContain("src/ui/App.tsx");
});

it("identifies the complete performance artifact, including desktop code, save format and media", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-performance-build-"));
  const files = {
    "dist/index.html": '<script src="./assets/index.js"></script>',
    "dist/assets/index.js": "renderer",
    "dist/prepared/sound.ogg": "audio",
    "desktop/main.cjs": "desktop",
    "desktop/steam-config.json": "{}",
    "package.json": '{"version":"1.0.0"}',
    "src/game/save-format.json": '{"version":1}',
  };
  try {
    for (const [name, bytes] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), bytes);
    }
    const baseline = await performanceBuildIdentity(root);
    for (const [name, bytes] of Object.entries(files)) {
      writeFileSync(path.join(root, name), `${bytes}changed`);
      expect(await performanceBuildIdentity(root), name).not.toBe(baseline);
      writeFileSync(path.join(root, name), bytes);
    }
    expect(await performanceBuildIdentity(root)).toBe(baseline);
    writeFileSync(path.join(root, "dist/index.html"), "");
    await expect(performanceBuildIdentity(root)).rejects.toThrow("production renderer");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("launches desktop verification against its own profile and built renderer despite inherited preview settings", () => {
  const inherited = {
    PATH: "tools",
    ELECTRON_RUN_AS_NODE: "1",
    FAUNA_DEV_URL: "http://127.0.0.1:48209",
    FAUNA_PREVIEW_USER_DATA: "other-profile",
    FAUNA_SMOKE_USER_DATA: "other-smoke",
    FAUNA_PERF_CAPTURE: "1",
    FAUNA_DISABLE_STEAM: "0",
  };
  const before = { ...inherited };
  expect(isolatedDesktopEnvironment("owned-profile", inherited)).toEqual({
    PATH: "tools",
    FAUNA_SMOKE_USER_DATA: "owned-profile",
    FAUNA_DISABLE_STEAM: "1",
  });
  expect(inherited).toEqual(before);
});

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
    format: 2,
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
    "src/game/save-format.json": Buffer.from('{"version":1}'),
    "dist/index.html": Buffer.from('<script src="./app.js"></script>'),
    "dist/app.js": Buffer.from("production"),
    "dist/prepared/art.svg": Buffer.from("image"),
  };
  const options = {
    expected: { version: "1.0" },
    runtimeFiles: {
      "desktop/main.cjs": main,
      "src/game/save-format.json": entries["src/game/save-format.json"],
    },
    receipt: {
      records: {
        image: { url: "./prepared/art.svg", outputHash: createHash("sha256").update("image").digest("hex") },
      },
    },
  };
  const read = (name) => entries[name];
  expect(verifyArchive(read, options).media).toBe(1);
  const saveFormat = entries["src/game/save-format.json"];
  delete entries["src/game/save-format.json"];
  expect(() => verifyArchive(read, options)).toThrow("save-format.json");
  entries["src/game/save-format.json"] = Buffer.from('{"version":0}');
  expect(() => verifyArchive(read, options)).toThrow("runtime differs");
  entries["src/game/save-format.json"] = saveFormat;
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

it("does not let the internal worker bypass report-directory confinement", async () => {
  await expect(worker("unused.json", path.join(os.tmpdir(), "outside-fauna-report.json"))).rejects.toThrow(
    "remain under reports",
  );
});

it("checks the shipped Electron runtime and rejects missing or empty files", () => {
  const sizes = new Map(WINDOWS_RUNTIME_FILES.map((name) => [name, 1]));
  expect(sizes.has("chrome_elf.dll")).toBe(false);
  expect(() => verifyWindowsRuntime((name) => sizes.get(name))).not.toThrow();
  sizes.set("dxcompiler.dll", 0);
  expect(() => verifyWindowsRuntime((name) => sizes.get(name))).toThrow("dxcompiler.dll");
  sizes.delete("dxcompiler.dll");
  expect(() => verifyWindowsRuntime((name) => sizes.get(name))).toThrow("dxcompiler.dll");
});
