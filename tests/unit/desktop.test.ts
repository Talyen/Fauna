import { createGame } from "../../src/game/engine";
import { encodeSave } from "../../src/game/save";
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
      const values = [1, 2, 3, 4, 5, 6, 7].map((revision) => JSON.stringify({ version: 11, revision }));
      await storage.write(encodeSave(createGame()));
      await expect(storage.write(JSON.stringify({ version: 10 }))).rejects.toThrow("Unsupported");
      const writes = values.map((data) => storage.write(data));
      await storage.drain();
      await Promise.all(writes);
      expect((await storage.readCandidates()).map((c: { data: string }) => c.data)).toEqual(
        [...values].reverse().slice(0, 3),
      );
      expect(await readFile(path.join(directory, "expedition.json"), "utf8")).toBe(values[6]);
      await writeFile(path.join(directory, "expedition.json"), "corrupt");
      expect((await storage.readCandidates())[1].data).toBe(values[5]);
      await expect(storage.write("broken")).rejects.toThrow();
      await expect(storage.write(JSON.stringify({ version: 999 }))).rejects.toThrow();
      await expect(storage.write("x".repeat(100001))).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});

const { isDevelopmentUrl } = createRequire(import.meta.url)("../../desktop/dev-url.cjs");
it("trusts only an exact explicit loopback HTTP development origin", () => {
  expect(isDevelopmentUrl("http://127.0.0.1:48209")).toBe(true);
  expect(isDevelopmentUrl("http://127.0.0.1:12345")).toBe(true);
  for (const url of [
    "http://127.0.0.1:99999",
    "http://127.0.0.1:12345/other",
    "http://127.0.0.1:12345/",
    "http://user@127.0.0.1:12345",
    "http://localhost:12345",
    "https://127.0.0.1:12345",
    "http://example.com:12345",
    "file:///tmp/index.html",
  ])
    expect(isDevelopmentUrl(url)).toBe(false);
});
