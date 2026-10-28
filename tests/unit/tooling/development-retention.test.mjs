import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { snapshot } from "../../../scripts/lib/development-package-receipt.mjs";
import { expect, it } from "vitest";
import { repository } from "../../support/tooling.mjs";
import { developmentPackage } from "../../../scripts/release/development-package.mjs";
import {
  inspectDevelopment,
  leaseLatestDevelopment,
  leasePackage,
} from "../../../scripts/release/development-retention.mjs";

it("retains the latest and protected packages while cleaning only sealed idle outputs", () => {
  const root = repository({ "package.json": "{}", ".gitignore": "release/\n" }, "fauna-dev-package-");
  const legacy = path.join(root, "release/win-unpacked");
  mkdirSync(legacy, { recursive: true });
  writeFileSync(path.join(legacy, "legacy.exe"), "unknown");
  const run = (code = 0) =>
    developmentPackage(root, ["--dir", "--publish", "never"], {
      env: {},
      idle: () => true,
      graceMs: 0,
      runner: (_command, args) => {
        const output = args
          .find((arg) => arg.startsWith("--config.directories.output="))
          .split("=")
          .slice(1)
          .join("=");
        mkdirSync(path.join(output, "win-unpacked"));
        writeFileSync(path.join(output, "win-unpacked/Fauna.exe"), `output-${Math.random()}`);
        return { status: code, signal: null };
      },
    });
  expect(run()).toBe(0);
  const first = leaseLatestDevelopment(root);
  const firstEntry = path.dirname(path.dirname(first.directory));
  expect(run()).toBe(0);
  expect(existsSync(first.directory)).toBe(true);
  const explicit = leasePackage(root, first.directory);
  expect(explicit.directory).toBe(first.directory);
  explicit.release();
  const second = leaseLatestDevelopment(root);
  const secondEntry = path.dirname(path.dirname(second.directory));
  second.release();
  writeFileSync(path.join(secondEntry, ".retention-keep"), "");
  first.release();
  expect(inspectDevelopment(root, { idle: () => true }).candidates).toEqual([]);
  expect(inspectDevelopment(root, { idle: () => true, graceMs: 0 }).candidates).toContain(firstEntry);
  expect(inspectDevelopment(root, { idle: () => false }).candidates).toEqual([]);
  const denied = inspectDevelopment(root, {
    idle: () => ({ idle: false, denied: true, reason: "Permission denied" }),
    graceMs: 0,
  });
  expect(denied.preserved).toContainEqual({ path: firstEntry, reason: "Permission denied" });
  expect(existsSync(first.directory)).toBe(true);
  expect(run()).toBe(0);
  expect(existsSync(first.directory)).toBe(false);
  expect(existsSync(second.directory)).toBe(true);
  const latest = leaseLatestDevelopment(root);
  const latestEntry = path.dirname(path.dirname(latest.directory));
  latest.release();
  writeFileSync(
    path.join(latestEntry, ".retention-distributed"),
    "distributed with its symbols and provenance",
  );
  expect(run()).toBe(0);
  expect(existsSync(latest.directory)).toBe(true);
  const current = leaseLatestDevelopment(root);
  const currentEntry = path.dirname(path.dirname(current.directory));
  current.release();
  expect(run(1)).toBe(1);
  expect(existsSync(current.directory)).toBe(true);
  const receipts = readdirSync(path.dirname(firstEntry))
    .filter((name) => name !== ".lock")
    .map((name) => JSON.parse(readFileSync(path.join(path.dirname(firstEntry), name, "receipt.json"))));
  expect(receipts.filter((receipt) => receipt.result === "failed")).toHaveLength(1);
  const failed = receipts.find((receipt) => receipt.result === "failed");
  expect(existsSync(path.join(path.dirname(firstEntry), failed.id, "output"))).toBe(false);
  const unknown = path.join(path.dirname(firstEntry), "00000000-0000-4000-8000-000000000000");
  mkdirSync(unknown);
  writeFileSync(path.join(unknown, "unique"), "unknown");
  const audit = inspectDevelopment(root, { idle: () => true });
  expect(audit.latest).toBe(currentEntry);
  expect(audit.candidates).toEqual([]);
  expect(readFileSync(path.join(legacy, "legacy.exe"), "utf8")).toBe("unknown");
  expect(readFileSync(path.join(unknown, "unique"), "utf8")).toBe("unknown");
  writeFileSync(path.join(current.directory, "Fauna.exe"), "changed after packaging");
  expect(run()).toBe(0);
  expect(readFileSync(path.join(current.directory, "Fauna.exe"), "utf8")).toBe("changed after packaging");
  let interruptedOutput;
  expect(
    developmentPackage(root, [], {
      env: {},
      idle: () => true,
      runner: (_command, args) => {
        interruptedOutput = args.at(-1).slice("--config.directories.output=".length);
        writeFileSync(path.join(interruptedOutput, "partial"), "unfinished");
        return { status: null, signal: "SIGTERM" };
      },
    }),
  ).toBe(1);
  expect(readFileSync(path.join(interruptedOutput, "partial"), "utf8")).toBe("unfinished");
});

it("hashes differently sized package files without retaining prior buffer bytes", () => {
  const root = repository({ "package.json": "{}" }, "fauna-package-hash-");
  const output = path.join(root, "output");
  mkdirSync(output);
  const files = [
    ["a", Buffer.alloc(1024 * 1024 + 7, 65)],
    ["b", Buffer.from("small")],
    ["c", Buffer.alloc(0)],
  ];
  for (const [name, bytes] of files) writeFileSync(path.join(output, name), bytes);
  expect(snapshot(output)).toEqual([
    ["", "directory"],
    ...files.map(([name, bytes]) => [
      name,
      "file",
      bytes.length,
      createHash("sha256").update(bytes).digest("hex"),
    ]),
  ]);
});
