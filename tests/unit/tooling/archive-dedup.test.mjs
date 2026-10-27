import { copyFileSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { put, temporaryDirectory, repository } from "../../support/tooling.mjs";
import { archiveFileHash, deduplicateArchive } from "../../../scripts/lib/archive-dedup.mjs";
import { createWorktree } from "../../../scripts/worktree.mjs";
import { removeMergedTask } from "../../../scripts/worktree-cleanup.mjs";

it("shares only verified archive copies and keeps both independently writable", () => {
  const root = temporaryDirectory("fauna-archive-dedup-");
  const old = path.join(root, "task-old"),
    current = path.join(root, "task-new");
  const content = Buffer.alloc(70_000, 7);
  put(old, "files/reports/frame.png", content);
  put(current, "files/reports/frame.png", content);
  const previous = path.join(old, "files/reports/frame.png"),
    target = path.join(current, "files/reports/frame.png");
  const hash = archiveFileHash(target),
    stat = lstatSync(target);
  const record = {
    path: "files/reports/frame.png",
    hash,
    size: stat.size,
    ino: stat.ino,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
  };
  writeFileSync(path.join(old, "manifest.json"), JSON.stringify({ dedup: [record] }));
  const result = deduplicateArchive(root, current, [record], { cloneFile: copyFileSync });
  expect(result.clonedBytes).toBe(content.length);
  writeFileSync(target, "updated archive");
  expect(readFileSync(previous)).toEqual(content);
  put(current, "files/reports/frame.png", content);
  const fresh = lstatSync(target);
  Object.assign(record, { ino: fresh.ino, mtimeMs: fresh.mtimeMs, ctimeMs: fresh.ctimeMs });
  writeFileSync(previous, Buffer.alloc(content.length, 8));
  expect(deduplicateArchive(root, current, [record], { cloneFile: copyFileSync }).clonedBytes).toBe(0);
  expect(readFileSync(target)).toEqual(content);
});

it("indexes completed archives and preserves independent evidence on retirement", () => {
  const root = repository({ ".gitignore": ".worktrees/\nreports/\n", keep: "source" }, "fauna-archives-");
  const content = Buffer.alloc(70_000, 3);
  const first = createWorktree(root, "first");
  put(first.path, "reports/image.png", content);
  const firstArchive = removeMergedTask(root, first.branch, { keepBranch: true }).archive;
  const second = createWorktree(root, "second");
  put(second.path, "reports/image.png", content);
  const secondArchive = removeMergedTask(root, second.branch, { keepBranch: true }).archive;
  const firstRecord = JSON.parse(readFileSync(path.join(firstArchive, "manifest.json"), "utf8"));
  const secondRecord = JSON.parse(readFileSync(path.join(secondArchive, "manifest.json"), "utf8"));
  expect(firstRecord.dedup[0].hash).toBe(secondRecord.dedup[0].hash);
  writeFileSync(path.join(secondArchive, "files/reports/image.png"), "changed");
  expect(readFileSync(path.join(firstArchive, "files/reports/image.png"))).toEqual(content);
});
