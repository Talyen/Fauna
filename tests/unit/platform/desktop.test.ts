import { createGame } from "../../../src/game/engine";
import { encodeSave } from "../../../src/game/save";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
const { createStorage } = createRequire(import.meta.url)("../../../desktop/storage.cjs");
describe("desktop storage", () => {
  it("atomically installs serialized saves with rotating backups and drains admitted writes", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
    try {
      const storage = createStorage(directory);
      const values = [1, 2, 3, 4, 5, 6, 7].map((revision) => encodeSave({ ...createGame(), revision }));
      await storage.write(encodeSave(createGame()));
      await expect(storage.write(JSON.stringify({ version: 11 }))).rejects.toThrow("Unsupported");
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

const { isDevelopmentUrl } = createRequire(import.meta.url)("../../../desktop/dev-url.cjs");
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

it.each(["expedition.json", "expedition.json.bak1"])(
  "recovers readable desktop slots when %s is unreadable",
  async (unreadable) => {
    const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
    try {
      const data = encodeSave(createGame(7));
      await mkdir(path.join(directory, unreadable));
      await writeFile(
        path.join(directory, unreadable === "expedition.json" ? "expedition.json.bak1" : "expedition.json"),
        data,
      );
      expect(await createStorage(directory).readCandidates()).toContainEqual({
        source: unreadable === "expedition.json" ? "backup" : "primary",
        data,
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  },
);

it("reports unreadable desktop storage when no candidate can be recovered", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
  try {
    await mkdir(path.join(directory, "expedition.json"));
    await expect(createStorage(directory).readCandidates()).rejects.toThrow("unreadable");
  } finally {
    await rm(directory, { recursive: true });
  }
});

it("preserves both recovery checkpoints when a backup copy fails partway through", async () => {
  const fs = createRequire(import.meta.url)("node:fs/promises") as typeof import("node:fs/promises");
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
  const storage = createStorage(directory);
  const primary = path.join(directory, "expedition.json");
  const values = [1, 2, 3, 4].map((revision) => encodeSave({ ...createGame(), revision }));
  const copy = vi.spyOn(fs, "copyFile");
  try {
    for (const value of values.slice(0, 3)) await storage.write(value);
    copy.mockImplementationOnce(async (_from, to) => {
      await writeFile(to, "partial checkpoint");
      throw new Error("disk full during backup copy");
    });

    await expect(storage.write(values[3])).rejects.toThrow("disk full");
    expect(await readFile(primary, "utf8")).toBe(values[2]);
    expect(await readFile(`${primary}.bak1`, "utf8")).toBe(values[1]);
    expect(await readFile(`${primary}.bak2`, "utf8")).toBe(values[0]);

    copy.mockRestore();
    await storage.write(values[3]);
    expect((await storage.readCandidates()).map((candidate: { data: string }) => candidate.data)).toEqual([
      values[3],
      values[2],
      values[1],
    ]);
  } finally {
    copy.mockRestore();
    await rm(directory, { recursive: true });
  }
});
