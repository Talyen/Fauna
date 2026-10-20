import { describe, expect, it } from "vitest";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
import { createGame } from "../../src/game/engine";
import type { Platform } from "../../src/platform/ports";
import { run, winBattle } from "./helpers";
class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
}
function platform(data: string | null = null): Platform {
  return {
    desktop: false,
    steam: { available: false },
    saves: {
      async readCandidates() {
        return data ? [{ source: "primary", data }] : [];
      },
      async write(value) {
        data = value;
      },
    },
  };
}
describe("save orchestration", () => {
  it("resumes committed combat and rewards without replaying commands", async () => {
    for (const game of [run(), winBattle()]) {
      const s = createSession(platform(JSON.stringify(game)));
      await s.load();
      expect(s.store.getState().game).toEqual(game);
      expect(s.store.getState().events).toEqual([]);
    }
  });
  it("recovers an intact backup without overwriting corrupt primary during load", async () => {
    const memory = new MemoryStorage();
    memory.setItem("fauna.save.v1", "broken");
    memory.setItem("fauna.save.v1.backup1", JSON.stringify(run()));
    const s = createSession(createBrowserPlatform(memory));
    await s.load();
    expect(s.store.getState().game.phase).toBe("battle");
    expect(s.store.getState().notice).toContain("backup");
    expect(memory.getItem("fauna.save.v1")).toBe("broken");
  });
  it("requires an explicit fresh start when every candidate is invalid", async () => {
    const p = platform("broken");
    const s = createSession(p);
    await s.load();
    expect(s.command({ type: "draft", species: "mossback" })).toBe(false);
    s.startFresh();
    await s.flush();
    expect(s.store.getState().recoveryRequired).toBe(false);
    expect((await p.saves.readCandidates())[0]!.data).toBe(JSON.stringify(createGame()));
  });
  it("preserves primary and backups in browser storage and reports quota failures", async () => {
    const memory = new MemoryStorage();
    const p = createBrowserPlatform(memory);
    await p.saves.write("first");
    await p.saves.write("second");
    await p.saves.write("third");
    expect((await p.saves.readCandidates()).map((c) => c.data)).toEqual(["third", "second", "first"]);
    let fail = true;
    const failed = createSession({
      ...platform(),
      saves: {
        async readCandidates() {
          return [];
        },
        async write() {
          if (fail) throw new Error("disk full");
        },
      },
    });
    await failed.load();
    failed.command({ type: "draft", species: "mossback" });
    expect(await failed.flush()).toBe(false);
    expect(failed.store.getState().saveStatus).toBe("error");
    fail = false;
    failed.retrySave();
    expect(await failed.flush()).toBe(true);
  });
  it("serializes writes and quit waits for the newest accepted revision", async () => {
    const saved: string[] = [];
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => (release = resolve));
    let quit = false;
    const s = createSession({
      ...platform(),
      saves: {
        async readCandidates() {
          return [];
        },
        async write(data) {
          await blocked;
          saved.push(data);
        },
      },
      async quit() {
        quit = true;
      },
    });
    await s.load();
    s.command({ type: "draft", species: "mossback" });
    s.command({ type: "draft", species: "emberfox" });
    const quitting = s.quit();
    expect(quit).toBe(false);
    release();
    await quitting;
    expect(saved.map((raw) => JSON.parse(raw).revision)).toEqual([1, 2]);
    expect(quit).toBe(true);
  });
  it("does not erase data or admit commands after an I/O read failure", async () => {
    let writes = 0;
    const s = createSession({
      ...platform(),
      saves: {
        async readCandidates() {
          throw new Error("permission denied");
        },
        async write() {
          writes++;
        },
      },
    });
    await s.load();
    expect(s.store.getState().loadFailed).toBe(true);
    expect(s.command({ type: "draft", species: "mossback" })).toBe(false);
    s.retrySave();
    await s.flush();
    expect(writes).toBe(0);
  });
  it("revokes command capabilities and ignores stale load completions after disposal", async () => {
    const s = createSession(platform());
    const loading = s.load();
    await s.dispose();
    await loading;
    expect(s.store.getState().ready).toBe(false);
    expect(s.command({ type: "draft", species: "mossback" })).toBe(false);
  });
});
describe("desktop close handshake", () => {
  it("pauses new commands while renderer writes drain and declines close after a save failure", async () => {
    let requestClose: (() => Promise<boolean>) | undefined;
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => (release = resolve));
    let fail = false;
    const s = createSession({
      ...platform(),
      onCloseRequested(listener) {
        requestClose = listener;
        return () => {
          requestClose = undefined;
        };
      },
      saves: {
        async readCandidates() {
          return [];
        },
        async write() {
          await blocked;
          if (fail) throw new Error("full");
        },
      },
    });
    await s.load();
    s.command({ type: "draft", species: "mossback" });
    const closing = requestClose!();
    expect(s.command({ type: "draft", species: "emberfox" })).toBe(false);
    release();
    expect(await closing).toBe(true);
    await s.dispose();
    expect(requestClose).toBeUndefined();
    const failure = createSession({
      ...platform(),
      onCloseRequested(listener) {
        requestClose = listener;
        return () => {};
      },
      saves: {
        async readCandidates() {
          return [];
        },
        async write() {
          throw new Error("full");
        },
      },
    });
    fail = true;
    await failure.load();
    failure.command({ type: "draft", species: "mossback" });
    expect(await requestClose!()).toBe(false);
    expect(failure.store.getState().closing).toBe(false);
    expect(failure.command({ type: "draft", species: "emberfox" })).toBe(true);
    await failure.dispose();
  });
});

it("persists primary legacy migration without replaying its exhausted turn", async () => {
  const original = run(7);
  const { mana, ...battle } = original.battle!;
  const legacy = JSON.stringify({ ...original, version: 1, battle: { ...battle, energy: 0 } });
  const memory = new MemoryStorage();
  memory.setItem("fauna.save.v1", legacy);
  const session = createSession(createBrowserPlatform(memory));
  await session.load();
  await session.flush();
  const migrated = session.store.getState().game;
  expect(migrated.version).toBe(5);
  expect(migrated.battle!.mana).toBe(mana);
  expect(migrated.battle!.turn).toBe(original.battle!.turn + 1);
  expect(session.store.getState().events).toEqual([]);
  expect(memory.getItem("fauna.save.v1.backup1")).toBe(legacy);
  await session.dispose();
  const resumed = createSession(createBrowserPlatform(memory));
  await resumed.load();
  expect(resumed.store.getState().game).toEqual(migrated);
  await resumed.dispose();
});
