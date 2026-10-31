import { expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

it("keeps Jake file discovery and EJS template compilation working with the updated filelist", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fauna-filelist-"));
  try {
    for (const file of ["keep.txt", "skip.txt", "other.json"])
      writeFileSync(path.join(directory, file), file);
    const normalized = directory.split(path.sep).join("/");
    const jake = require("jake");
    const files = new jake.FileList();
    files.include(`${normalized}/*.txt`);
    files.exclude(`${normalized}/skip.txt`);
    expect(files.toArray()).toEqual([`${normalized}/keep.txt`]);
    expect(require("ejs").compile("<%= name %>")({ name: "Fauna" })).toBe("Fauna");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
