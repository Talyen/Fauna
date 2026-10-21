import { describe, expect, it, vi } from "vitest";
import { createSession } from "../../src/application/session";
import { createBrowserPlatform } from "../../src/platform/browser";
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
    expect(s.store.getState().error).toBe("");
    expect(memory.getItem("fauna.save.v1")).toBe("broken");
  });
  it("silently starts a playable profile when every candidate is invalid, retaining the primary until play", async () => {
    const p = platform("broken");
    const s = createSession(p);
    await s.load();
    expect((await p.saves.readCandidates())[0]!.data).toBe("broken");
    expect(s.store.getState().ready).toBe(true);
    expect(s.command({ type: "draft", species: "mossback" })).toBe(true);
    expect(await s.flush()).toBe(true);
    await s.dispose();
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
    s.command({ type: "start" });
    const quitting = s.quit();
    expect(quit).toBe(false);
    release();
    await quitting;
    expect(saved.map((raw) => JSON.parse(raw).revision)).toEqual([1, 2]);
    expect(quit).toBe(true);
  });
  it("permits in-memory play without overwriting inaccessible storage after read failure", async () => {
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
    expect(s.command({ type: "draft", species: "mossback" })).toBe(true);
    s.retrySave();
    await s.flush();
    expect(writes).toBe(0);
    await s.dispose();
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
  it("drains admitted writes and retries silently before allowing close after a save failure", async () => {
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
    expect(await requestClose!()).toBe(true);
    expect(failure.store.getState().closing).toBe(true);
    expect(failure.command({ type: "start" })).toBe(false);
    await failure.dispose();
  });
});

it("rejects obsolete development saves and recovers a current-format backup without rewriting it", async () => {
  const current = run(7);
  const obsolete = JSON.stringify({ ...current, version: 22 });
  const memory = new MemoryStorage();
  memory.setItem("fauna.save.v1", obsolete);
  memory.setItem("fauna.save.v1.backup1", JSON.stringify(current));
  const session = createSession(createBrowserPlatform(memory));
  await session.load();
  await session.flush();
  expect(session.store.getState().game).toEqual(current);
  expect(session.store.getState().events).toEqual([]);
  expect(session.store.getState().error).toBe("");
  expect(memory.getItem("fauna.save.v1")).toBe(obsolete);
  session.command({ type: "endTurn" });
  await session.flush();
  expect(JSON.parse(memory.getItem("fauna.save.v1")!).version).toBe(23);
  await session.dispose();
});

it("retries the latest committed state in the background and cancels retries on disposal", async () => {
  vi.useFakeTimers();
  try {
    let fail = true;
    const write = vi.fn(async (_data: string) => {
      if (fail) throw new Error("full");
    });
    const s = createSession({ ...platform(), saves: { readCandidates: async () => [], write } });
    await s.load();
    s.command({ type: "draft", species: "mossback" });
    await s.flush();
    s.command({ type: "start" });
    await s.flush();
    fail = false;
    await vi.advanceTimersByTimeAsync(5000);
    expect(await s.flush()).toBe(true);
    expect(JSON.parse(write.mock.calls.at(-1)![0]).revision).toBe(2);
    await s.dispose();
    const count = write.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(write).toHaveBeenCalledTimes(count);
  } finally {
    vi.useRealTimers();
  }
});
it("allows play after a stalled local read and ignores its late result", async () => {
  vi.useFakeTimers();
  try {
    let release!: (data: { source: string; data: string }[]) => void;
    const read = new Promise<{ source: string; data: string }[]>((resolve) => {
      release = resolve;
    });
    const s = createSession({
      ...platform(),
      saves: { readCandidates: async () => read, write: async () => {} },
    });
    const loading = s.load();
    await vi.advanceTimersByTimeAsync(5000);
    await loading;
    expect(s.store.getState().ready).toBe(true);
    expect(s.command({ type: "draft", species: "mossback" })).toBe(true);
    release([{ source: "primary", data: JSON.stringify(run()) }]);
    await s.flush();
    expect(s.store.getState().game.phase).toBe("draft");
    expect(s.store.getState().game.revision).toBe(1);
    await s.dispose();
  } finally {
    vi.useRealTimers();
  }
});
