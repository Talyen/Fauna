import { createGame } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { createSession } from "../../../src/application/session";
import { createPlatform } from "../../../src/platform";
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
      const writes = values.map((data, index) =>
        storage.write(data, [encodeSave(createGame()), ...values.slice(0, index)].slice(-3)),
      );
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

it("retains validated distinct desktop backups after recovery and repeated saves", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
  const storage = createStorage(directory);
  const primary = path.join(directory, "expedition.json");
  const older = encodeSave(decodeSave(encodeSave({ ...createGame(3), revision: 10 })));
  const newer = encodeSave(decodeSave(encodeSave({ ...createGame(3), revision: 11 })));
  await writeFile(primary, "corrupt");
  await writeFile(`${primary}.bak1`, newer);
  await writeFile(`${primary}.bak2`, older);
  vi.stubGlobal("window", {
    faunaDesktop: {
      readCandidates: () => storage.readCandidates(),
      writeSave: (data: string, recoverable?: string[]) => storage.write(data, recoverable),
      onCloseRequested: () => () => {},
      quit: async () => {},
    },
  });
  const session = createSession(createPlatform());
  try {
    await session.load();
    expect(session.store.getState().game.revision).toBe(11);
    for (let attempt = 0; attempt < 2; attempt++) {
      session.retrySave();
      expect(await session.flush()).toBe(true);
    }
    expect(await readFile(`${primary}.bak1`, "utf8")).toBe(newer);
    expect(await readFile(`${primary}.bak2`, "utf8")).toBe(older);
    expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
      true,
    );
    expect(await session.flush()).toBe(true);
    expect(await readFile(`${primary}.bak1`, "utf8")).toBe(newer);
    expect(await readFile(`${primary}.bak2`, "utf8")).toBe(older);
  } finally {
    await session.dispose();
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true });
  }
});

it("preserves desktop backups without validation and rejects malformed recovery approvals", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
  const storage = createStorage(directory);
  const primary = path.join(directory, "expedition.json");
  const data = encodeSave(createGame(3));
  const backup = encodeSave(createGame(7));
  try {
    await writeFile(primary, "corrupt");
    await writeFile(`${primary}.bak1`, backup);
    await storage.write(data);
    expect(await readFile(`${primary}.bak1`, "utf8")).toBe(backup);
    for (const approvals of [null, "checkpoint", [4], Array(4).fill(backup), ["x".repeat(100001)]])
      await expect(storage.write(data, approvals)).rejects.toThrow("Invalid recovery checkpoints");
    expect(await readFile(primary, "utf8")).toBe(data);
    expect(await readFile(`${primary}.bak1`, "utf8")).toBe(backup);
  } finally {
    await rm(directory, { recursive: true });
  }
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
    for (const value of values.slice(0, 3)) await storage.write(value, values.slice(0, 3));
    copy.mockImplementationOnce(async (_from, to) => {
      await writeFile(to, "partial checkpoint");
      throw new Error("disk full during backup copy");
    });

    await expect(storage.write(values[3], values.slice(0, 3))).rejects.toThrow("disk full");
    expect(await readFile(primary, "utf8")).toBe(values[2]);
    expect(await readFile(`${primary}.bak1`, "utf8")).toBe(values[1]);
    expect(await readFile(`${primary}.bak2`, "utf8")).toBe(values[0]);

    copy.mockRestore();
    await storage.write(values[3], values.slice(0, 3));
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

it("preserves distinct recovery checkpoints when the second backup copy fails", async () => {
  const fs = createRequire(import.meta.url)("node:fs/promises") as typeof import("node:fs/promises");
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-storage-"));
  const storage = createStorage(directory);
  const values = [1, 2, 3, 4].map((revision) => encodeSave({ ...createGame(), revision }));
  const originalCopy = fs.copyFile.bind(fs);
  const copy = vi.spyOn(fs, "copyFile");
  try {
    for (const value of values.slice(0, 3)) await storage.write(value, values.slice(0, 3));
    copy.mockImplementationOnce(async (from, to) => originalCopy(from, to));
    copy.mockRejectedValueOnce(new Error("disk full during second backup copy"));
    await expect(storage.write(values[3], values.slice(0, 3))).rejects.toThrow("disk full");
    expect((await storage.readCandidates()).map((candidate: { data: string }) => candidate.data)).toEqual([
      values[2],
      values[1],
      values[0],
    ]);
  } finally {
    copy.mockRestore();
    await rm(directory, { recursive: true });
  }
});
