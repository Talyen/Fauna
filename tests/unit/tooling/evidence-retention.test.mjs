import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { put, temporaryDirectory } from "../../support/tooling.mjs";
import { expireEvidence, expiringEvidence } from "../../../scripts/lib/evidence-retention.mjs";

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
