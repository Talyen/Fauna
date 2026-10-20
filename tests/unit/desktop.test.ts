import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
const { createStorage } = createRequire(import.meta.url)("../../desktop/storage.cjs");
describe("desktop storage", () => {
  it("atomically installs serialized saves with rotating backups and drains admitted writes", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
    try {
      const storage = createStorage(directory);
      const values = [1, 2, 3, 4].map((revision) => JSON.stringify({ version: revision, revision }));
      const writes = values.map((data) => storage.write(data));
      await storage.drain();
      await Promise.all(writes);
      expect((await storage.readCandidates()).map((c: { data: string }) => c.data)).toEqual(
        [...values].reverse().slice(0, 3),
      );
      expect(await readFile(path.join(directory, "expedition.json"), "utf8")).toBe(values[3]);
      await writeFile(path.join(directory, "expedition.json"), "corrupt");
      expect((await storage.readCandidates())[1].data).toBe(values[2]);
      await expect(storage.write("broken")).rejects.toThrow();
      await expect(storage.write(JSON.stringify({ version: 999 }))).rejects.toThrow();
      await expect(storage.write("x".repeat(100001))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
