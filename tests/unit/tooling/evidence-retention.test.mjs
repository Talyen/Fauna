import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { put, repository, temporaryDirectory } from "../../support/tooling.mjs";
import { expireEvidence, expiringEvidence } from "../../../scripts/lib/evidence-retention.mjs";
import { review } from "../../../scripts/agent/agent-review.mjs";
import { sealBalanceReport } from "../../../scripts/balance/report-retention.mjs";
import {
  createDevelopmentRun,
  finishDevelopmentRun,
  withDevelopmentLock,
} from "../../../scripts/release/development-retention.mjs";

it("expires only unchanged, unpinned evidence from new completed archives after 24 hours", () => {
  const root = temporaryDirectory("fauna-retention-");
  const archive = path.join(root, "task-one");
  put(archive, "files/reports/source.png", "preserve source");
  put(archive, "files/test-results/result.txt", "test output");
  put(archive, "files/blob-report/output.zip", "generated output");
  put(archive, "files/playwright-report/keep.txt", "kept output");
  put(archive, "files/private.log", "not classified as evidence");
  const retention = expiringEvidence(
    archive,
    ["reports/", "test-results/", "blob-report/", "playwright-report/", "private.log"],
    100,
  );
  writeFileSync(path.join(archive, "manifest.json"), JSON.stringify({ retention }));
  put(archive, "files/test-results/added.txt", "new work");
  put(archive, "files/playwright-report/.retention-keep", "");
  const legacy = path.join(root, "task-legacy");
  put(legacy, "files/reports/frame.png", "historical evidence");
  writeFileSync(path.join(legacy, "manifest.json"), JSON.stringify({ ignored: ["reports/"] }));
  expect(expireEvidence(root, { now: 100 + 86_400_000 - 1 })).toEqual([]);
  expect(expireEvidence(root, { now: 100 + 86_400_000 })).toEqual([path.join(archive, "files/blob-report")]);
  expect(existsSync(path.join(archive, "files/reports/source.png"))).toBe(true);
  expect(readFileSync(path.join(archive, "files/test-results/added.txt"), "utf8")).toBe("new work");
  expect(existsSync(path.join(archive, "files/playwright-report/keep.txt"))).toBe(true);
  expect(existsSync(path.join(archive, "files/private.log"))).toBe(true);
  expect(existsSync(path.join(legacy, "files/reports/frame.png"))).toBe(true);
  expect(expireEvidence(root, { now: 100 + 2 * 86_400_000 })).toEqual([]);
});

it("preserves an entire archive with an explicit retention marker", () => {
  const root = temporaryDirectory("fauna-retention-pinned-");
  const archive = path.join(root, "task-one");
  put(archive, "files/test-results/frame.png", "retain");
  const retention = expiringEvidence(archive, ["test-results/"], 0);
  writeFileSync(path.join(archive, "manifest.json"), JSON.stringify({ retention }));
  writeFileSync(path.join(archive, ".retention-keep"), "");
  expect(expireEvidence(root, { now: 86_400_000 })).toEqual([]);
  expect(existsSync(path.join(archive, "files/test-results/frame.png"))).toBe(true);
});

it("expires only complete, unchanged focused captures within mixed reports", () => {
  const root = temporaryDirectory("fauna-retention-capture-");
  const archive = path.join(root, "task-one");
  const capture = "reports/review/home-12345678-1234-4123-8123-123456789abc";
  put(archive, `files/${capture}/frame.png`, "frame");
  put(archive, `files/${capture}/checkpoint.json`, "fixture");
  put(
    archive,
    `files/${capture}/evidence.json`,
    JSON.stringify({
      complete: true,
      runtime: "Vite browser preview",
      frames: [{ file: "frame.png" }],
    }),
  );
  put(archive, "files/reports/localization/font-sources/source.otf", "source");
  const retention = expiringEvidence(archive, ["reports/"], 0);
  writeFileSync(path.join(archive, "manifest.json"), JSON.stringify({ retention }));
  expect(expireEvidence(root, { now: 86_400_000 })).toEqual([path.join(archive, "files", capture)]);
  expect(existsSync(path.join(archive, "files/reports/localization/font-sources/source.otf"))).toBe(true);
});

it("expires reconstructible committed reviews but preserves reviews containing unfinished source", () => {
  const source = repository({ ".gitignore": "reports/\n", "source.txt": "committed" });
  const clean = review(source, [], { base: "HEAD" });
  put(source, "source.txt", "unfinished source");
  const dirty = review(source, [], { base: "HEAD" });
  expect(clean.retention).toBeDefined();
  expect(dirty.retention).toBeUndefined();

  const root = temporaryDirectory("fauna-review-retention-");
  const archive = path.join(root, "task-one");
  put(archive, "files/reports/placeholder", "retain");
  cpSync(path.join(source, "reports/agent-diff"), path.join(archive, "files/reports/agent-diff"), {
    recursive: true,
  });
  const retention = expiringEvidence(archive, ["reports/"], 0);
  writeFileSync(path.join(archive, "manifest.json"), JSON.stringify({ retention }));
  expect(expireEvidence(root, { now: 86_400_000 })).toEqual([
    path.dirname(clean.patches).replace(source, path.join(archive, "files")),
  ]);
  expect(
    JSON.parse(readFileSync(path.join(archive, "manifest.json"), "utf8")).retention.entries[0].review,
  ).toMatchObject({ retention: clean.retention, selected: clean.selected });
  expect(
    readFileSync(
      path.dirname(dirty.patches).replace(source, path.join(archive, "files")) + "/patches.txt",
      "utf8",
    ),
  ).toContain("unfinished source");
});

it("expires only sealed complete balance and identifiable generated runs", async () => {
  const root = temporaryDirectory("fauna-retention-generated-");
  const archive = path.join(root, "task-one"),
    files = path.join(archive, "files");
  put(
    files,
    "reports/balance/run-1/report.json",
    JSON.stringify({ complete: true, evidencePolicy: "failures" }),
  );
  put(files, "reports/balance/run-2/report.json", JSON.stringify({ complete: true, evidencePolicy: "full" }));
  await sealBalanceReport(path.join(files, "reports/balance/run-1"), true, { root: files, now: 0 });
  await sealBalanceReport(path.join(files, "reports/balance/run-2"), true, { root: files, now: 0 });
  put(
    files,
    "reports/interactions/run-1/report.json",
    JSON.stringify({ format: 1, complete: true, actions: [] }),
  );
  put(
    files,
    "reports/performance/capture-1/report.json",
    JSON.stringify({ format: 3, complete: true, environment: { trace: false }, cases: [{ id: "battle" }] }),
  );
  put(files, "reports/performance/capture-1/battle-sample.json", "{}");
  put(files, "reports/performance/capture-1/battle-summary.json", "{}");
  put(files, "reports/performance/capture-1/battle-hitches.md", "hitches");
  const retention = expiringEvidence(archive, ["reports/"], 0);
  writeFileSync(path.join(archive, "manifest.json"), JSON.stringify({ retention }));
  const removed = expireEvidence(root, { now: 86_400_000 });
  expect(removed).toHaveLength(3);
  expect(existsSync(path.join(files, "reports/balance/run-2/report.json"))).toBe(true);
});

it("expires sealed archived development packages while retaining distributed and unknown releases", () => {
  const root = temporaryDirectory("fauna-retention-package-");
  const archive = path.join(root, "task-one"),
    files = path.join(archive, "files");
  put(files, "release/unknown.exe", "release artifact");
  const [normal, distributed] = withDevelopmentLock(files, () => {
    const runs = [
      createDevelopmentRun(files, { commit: "abc", dirty: false }),
      createDevelopmentRun(files, { commit: "abc", dirty: false }),
    ];
    for (const run of runs) {
      put(run.output, "win-unpacked/Fauna.exe", "development output");
      finishDevelopmentRun(run, "success");
    }
    return runs;
  });
  writeFileSync(path.join(distributed.entry, ".retention-distributed"), "retain");
  const retention = expiringEvidence(archive, ["release/"], 0);
  writeFileSync(path.join(archive, "manifest.json"), JSON.stringify({ retention }));
  expect(expireEvidence(root, { now: 86_400_000 })).toEqual([normal.output]);
  expect(existsSync(path.join(distributed.output, "win-unpacked/Fauna.exe"))).toBe(true);
  expect(existsSync(path.join(files, "release/unknown.exe"))).toBe(true);
});
