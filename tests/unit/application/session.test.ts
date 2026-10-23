import { describe, expect, it, vi } from "vitest";
import { createSession as createSeededSession } from "../../../src/application/session";
import { createBrowserPlatform } from "../../../src/platform/browser";
import type { Platform } from "../../../src/platform/ports";
import { dispatch } from "../../../src/game/engine";
import { run, winBattle } from "../../support/game";
// Keep lifecycle fixtures independent of roster-driven changes to the default starter offers.
const createSession: typeof createSeededSession = (platform, seed = 3, capabilities) =>
  createSeededSession(platform, seed, capabilities);
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
it.each([false, true])("captures development permission at session creation (%s)", async (development) => {
  const capabilities = { development };
  const s = createSession(platform(JSON.stringify(run())), 3, capabilities);
  try {
    await s.load();
    capabilities.development = !development;
    const before = s.store.getState().game;
    expect(s.command({ type: "devWinBattle" })).toBe(development);
    if (development) expect(s.store.getState().game.phase).toBe("recruit");
    else expect(s.store.getState().game).toBe(before);
  } finally {
    await s.dispose();
  }
});

it("saves the latest browser checkpoint when backup growth exceeds the storage quota", async () => {
  const memory = new MemoryStorage();
  const saved = JSON.stringify(run());
  memory.setItem("fauna.save.v1", saved);
  const set = memory.setItem.bind(memory);
  // Replacing the primary fits; allocating another checkpoint does not.
  memory.setItem = (key, data) => {
    if (key.includes("backup")) throw new Error("quota exceeded");
    set(key, data);
  };
  const s = createSession(createBrowserPlatform(memory));
  try {
    await s.load();
    expect(s.command({ type: "endTurn" })).toBe(true);
    expect(await s.flush()).toBe(true);
    expect(JSON.parse(memory.getItem("fauna.save.v1")!)).toEqual(s.store.getState().game);
    const resumed = createSession(createBrowserPlatform(memory));
    try {
      await resumed.load();
      expect(resumed.store.getState().game).toEqual(s.store.getState().game);
    } finally {
      await resumed.dispose();
    }
  } finally {
    await s.dispose();
  }
});

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
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
    expect(await s.flush()).toBe(true);
    await s.dispose();
  });
  it.each(["primary", "backup1"])(
    "retains the intact recovery slot when corrupt %s precedes a failed write",
    async (corrupt) => {
      const memory = new MemoryStorage();
      const saved = JSON.stringify(run());
      memory.setItem("fauna.save.v1", "broken primary");
      memory.setItem("fauna.save.v1.backup1", corrupt === "backup1" ? "broken backup" : saved);
      if (corrupt === "backup1") memory.setItem("fauna.save.v1.backup2", saved);
      const set = memory.setItem.bind(memory);
      memory.setItem = (key, data) => {
        if (key === "fauna.save.v1") throw new Error("quota exceeded");
        set(key, data);
      };
      const p = createBrowserPlatform(memory);
      const s = createSession(p);
      try {
        await s.load();
        expect(s.store.getState().game).toEqual(JSON.parse(saved));
        expect(s.command({ type: "endTurn" })).toBe(true);
        expect(await s.flush()).toBe(false);
        expect((await p.saves.readCandidates()).some((candidate) => candidate.data === saved)).toBe(true);
      } finally {
        await s.dispose();
      }
    },
  );
  it("preserves primary and backups in browser storage and reports quota failures", async () => {
    const memory = new MemoryStorage();
    const p = createBrowserPlatform(memory);
    const snapshots = [1, 2, 3].map((revision) => JSON.stringify({ ...run(), revision }));
    for (const data of snapshots) await p.saves.write(data, (candidate) => snapshots.includes(candidate));
    expect((await p.saves.readCandidates()).map((c) => c.data)).toEqual([...snapshots].reverse());
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
    failed.command({ type: "draft", species: failed.store.getState().game.starterOffers[0]! });
    expect(await failed.flush()).toBe(false);
    expect(failed.store.getState().saveStatus).toBe("error");
    fail = false;
    failed.retrySave();
    expect(await failed.flush()).toBe(true);
  });
  it.each(["quit", "dispose"] as const)(
    "serializes writes and %s drains every admitted revision",
    async (close) => {
      const saved: string[] = [];
      let releaseFirst!: () => void;
      let releaseSecond!: () => void;
      let enteredSecond!: () => void;
      const first = new Promise<void>((resolve) => (releaseFirst = resolve));
      const second = new Promise<void>((resolve) => (releaseSecond = resolve));
      const secondStarted = new Promise<void>((resolve) => (enteredSecond = resolve));
      let active = 0;
      let maximumActive = 0;
      const write = vi.fn(async (data: string) => {
        maximumActive = Math.max(maximumActive, ++active);
        if (JSON.parse(data).revision === 1) await first;
        else {
          enteredSecond();
          await second;
        }
        saved.push(data);
        active--;
      });
      const quit = vi.fn(async () => {});
      const s = createSession({
        ...platform(),
        saves: { readCandidates: async () => [], write },
        quit,
      });
      await s.load();
      expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
      expect(s.command({ type: "start" })).toBe(true);
      let finished = false;
      const closing = s[close]().then(() => {
        finished = true;
      });
      try {
        await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
        expect(finished).toBe(false);
        expect(quit).not.toHaveBeenCalled();
        expect(s.command({ type: "beginBattle" })).toBe(false);
        releaseFirst();
        await secondStarted;
        expect(saved.map((raw) => JSON.parse(raw).revision)).toEqual([1]);
        expect(finished).toBe(false);
        expect(quit).not.toHaveBeenCalled();
        releaseSecond();
        await closing;
        expect(saved.map((raw) => JSON.parse(raw).revision)).toEqual([1, 2]);
        expect(maximumActive).toBe(1);
        expect(quit).toHaveBeenCalledTimes(close === "quit" ? 1 : 0);
      } finally {
        releaseFirst();
        releaseSecond();
        await closing;
        await s.dispose();
      }
    },
  );
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
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
    s.retrySave();
    await s.flush();
    expect(writes).toBe(0);
    await s.dispose();
  });
  it("revokes command capabilities and ignores stale load completions after disposal", async () => {
    let release!: (data: { source: string; data: string }[]) => void;
    const pending = new Promise<{ source: string; data: string }[]>((resolve) => {
      release = resolve;
    });
    const write = vi.fn(async () => {});
    const s = createSession({
      ...platform(),
      saves: { readCandidates: () => pending, write },
    });
    const loading = s.load();
    await s.dispose();
    const disposed = s.store.getState();
    release([{ source: "primary", data: JSON.stringify(run()) }]);
    await loading;
    expect(s.store.getState()).toBe(disposed);
    expect(s.store.getState().ready).toBe(false);
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(false);
    s.retrySave();
    await s.flush();
    expect(write).not.toHaveBeenCalled();
  });
});
describe("desktop close handshake", () => {
  it("drains admitted writes and retries silently before allowing close after a save failure", async () => {
    let requestClose: (() => Promise<boolean>) | undefined;
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => (release = resolve));
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
        },
      },
    });
    await s.load();
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
    const game = s.store.getState().game;
    expect(dispatch(game, { type: "start" }).accepted).toBe(true);
    let closed = false;
    const closing = requestClose!();
    void closing.then(() => {
      closed = true;
    });
    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(closed).toBe(false);
      expect(s.command({ type: "start" })).toBe(false);
      expect(s.store.getState().game).toBe(game);
      release();
      expect(await closing).toBe(true);
    } finally {
      release();
      await s.dispose();
    }
    expect(requestClose).toBeUndefined();
    const write = vi.fn(async () => {
      throw new Error("full");
    });
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
        write,
      },
    });
    await failure.load();
    expect(failure.command({ type: "draft", species: failure.store.getState().game.starterOffers[0]! })).toBe(
      true,
    );
    expect(await failure.flush()).toBe(false);
    expect(write).toHaveBeenCalledOnce();
    expect(await requestClose!()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
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
  expect(JSON.parse(memory.getItem("fauna.save.v1")!).version).toBe(current.version);
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
    s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
    await s.flush();
    s.command({ type: "start" });
    await s.flush();
    fail = false;
    await vi.advanceTimersByTimeAsync(5000);
    expect(await s.flush()).toBe(true);
    expect(JSON.parse(write.mock.calls.at(-1)![0]).revision).toBe(2);
    fail = true;
    expect(s.command({ type: "beginBattle" })).toBe(true);
    expect(await s.flush()).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    await s.dispose();
    expect(vi.getTimerCount()).toBe(0);
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
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
    release([{ source: "primary", data: JSON.stringify(run()) }]);
    await s.flush();
    expect(s.store.getState().game.phase).toBe("draft");
    expect(s.store.getState().game.revision).toBe(1);
    await s.dispose();
  } finally {
    vi.useRealTimers();
  }
});

it("persists commands issued synchronously by committed-state subscribers in revision order", async () => {
  const saved: number[] = [];
  const s = createSession({
    ...platform(),
    saves: {
      readCandidates: async () => [],
      write: async (data) => {
        saved.push(JSON.parse(data).revision);
      },
    },
  });
  await s.load();
  const unsubscribe = s.store.subscribe((view, previous) => {
    if (view.game.revision === 1 && previous.game.revision === 0) s.command({ type: "start" });
  });
  s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
  await s.flush();
  expect(s.store.getState().game.revision).toBe(2);
  expect(saved).toEqual([1, 2]);
  unsubscribe();
  await s.dispose();
});

it.each(["saved", "empty", "invalid"])(
  "keeps command admission closed throughout %s startup cloud reconciliation",
  async (candidate) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const identity = vi.fn(async () => {
      await gate;
      return { available: false, device: "", profile: "", importAvailable: false };
    });
    const s = createSession({
      ...platform(candidate === "saved" ? JSON.stringify(run()) : candidate === "invalid" ? "broken" : null),
      cloud: {
        identity,
        readLocal: async () => null,
        writeLocal: async () => {},
        preserve: async () => {},
        importStandalone: async () => [],
        list: async () => [],
        read: async () => null,
        write: async () => {},
      },
    });
    const admitted: boolean[] = [];
    let observedReady = false;
    const unsubscribe = s.store.subscribe((view) => {
      if (view.ready && !view.cloud.blocking && !observedReady) {
        observedReady = true;
        admitted.push(s.command({ type: "endTurn" }));
      }
    });
    const loading = s.load();
    await vi.waitFor(() => expect(identity).toHaveBeenCalledOnce());
    expect(admitted).toEqual([]);
    release();
    unsubscribe();
    await loading;
    expect(s.store.getState().ready).toBe(true);
    await s.dispose();
  },
);

it("bounds a stalled recovery read so saving and shutdown can finish without overwriting unknown data", async () => {
  vi.useFakeTimers();
  let s: ReturnType<typeof createSession> | undefined;
  try {
    let reads = 0;
    let release!: () => void;
    const stalled = new Promise<[]>((resolve) => {
      release = () => resolve([]);
    });
    const write = vi.fn(async () => {});
    const quit = vi.fn(async () => {});
    s = createSession({
      ...platform(),
      quit,
      saves: {
        readCandidates: async () => {
          if (++reads <= 2) throw new Error("permission denied");
          return stalled;
        },
        write,
      },
    });
    await s.load();
    s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
    let flushed: boolean | undefined;
    void s.flush().then((result) => {
      flushed = result;
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(flushed).toBe(false);
    const closing = s.quit();
    await vi.advanceTimersByTimeAsync(5000);
    await closing;
    expect(quit).toHaveBeenCalledOnce();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).not.toHaveBeenCalled();
    expect(s.store.getState().loadFailed).toBe(true);
  } finally {
    void s?.dispose();
    vi.useRealTimers();
  }
});

it.each(["fauna.save.v1", "fauna.save.v1.backup1"])(
  "recovers readable slots when %s cannot be read",
  async (unreadable) => {
    const memory = new MemoryStorage();
    const saved = JSON.stringify(run());
    memory.setItem(unreadable === "fauna.save.v1" ? "fauna.save.v1.backup1" : "fauna.save.v1", saved);
    const read = memory.getItem.bind(memory);
    memory.getItem = (key) => {
      if (key === unreadable) throw new Error("slot unavailable");
      return read(key);
    };
    const s = createSession(createBrowserPlatform(memory));
    try {
      await s.load();
      expect(s.store.getState().game).toEqual(JSON.parse(saved));
      expect(s.store.getState().ready).toBe(true);
    } finally {
      await s.dispose();
    }
  },
);

it("reports unreadable browser storage instead of treating inaccessible slots as an empty profile", async () => {
  const memory = new MemoryStorage();
  memory.getItem = () => {
    throw new Error("permission denied");
  };
  await expect(createBrowserPlatform(memory).saves.readCandidates()).rejects.toThrow("unreadable");
});

it("shares startup loading so a second caller cannot later replace committed play", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let releaseLater!: () => void;
  const later = new Promise<void>((resolve) => (releaseLater = resolve));
  let reads = 0;
  const readCandidates = vi.fn(async () => {
    await (++reads === 1 ? gate : later);
    return [{ source: "primary", data: JSON.stringify(run()) }];
  });
  const s = createSession({ ...platform(), saves: { readCandidates, write: async () => {} } });
  try {
    const first = s.load();
    const second = s.load();
    await vi.waitFor(() => expect(readCandidates).toHaveBeenCalled());
    release();
    await first;
    expect(s.store.getState().ready).toBe(true);
    expect(s.command({ type: "endTurn" })).toBe(true);
    const committed = s.store.getState().game;
    releaseLater();
    await second;
    expect(s.store.getState().game).toBe(committed);
  } finally {
    release();
    releaseLater();
    await s.dispose();
  }
});

it("flush drains writes admitted by save-completion subscribers", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const write = vi.fn(async () => {
    if (write.mock.calls.length === 2) await gate;
  });
  const s = createSession({ ...platform(), saves: { readCandidates: async () => [], write } });
  await s.load();
  let queued = false;
  const unsubscribe = s.store.subscribe((view) => {
    if (view.saveStatus === "saved" && !queued) {
      queued = true;
      s.command({ type: "start" });
    }
  });
  try {
    s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
    let finished = false;
    const flushing = s.flush().then(() => (finished = true));
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(finished).toBe(false);
    release();
    await flushing;
    expect(s.store.getState().saveStatus).toBe("saved");
  } finally {
    release();
    unsubscribe();
    await s.dispose();
  }
});

it("shares disposal across reentrant subscribers while draining admitted saves", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const removeClose = vi.fn();
  const removeOverlay = vi.fn();
  const s = createSession({
    ...platform(),
    onCloseRequested: () => removeClose,
    onOverlay: () => removeOverlay,
    saves: { readCandidates: async () => [], write: async () => gate },
  });
  await s.load();
  s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
  const disposals: Promise<void>[] = [];
  const unsubscribe = s.store.subscribe((view) => {
    if (view.closing && disposals.length < 2) {
      // Reserve the slot before disposal synchronously publishes again.
      const index = disposals.length;
      disposals.push(Promise.resolve());
      disposals[index] = s.dispose();
    }
  });
  try {
    const first = s.dispose();
    expect(disposals).toEqual([first]);
    expect(s.dispose()).toBe(first);
    expect(removeClose).toHaveBeenCalledOnce();
    expect(removeOverlay).toHaveBeenCalledOnce();
    let finished = false;
    void first.then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    release();
    await first;
    expect(finished).toBe(true);
  } finally {
    unsubscribe();
    release();
    await s.dispose();
  }
});

it("shares the close handshake and native quit across repeated requests", async () => {
  let requestClose!: () => Promise<boolean>;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const quit = vi.fn(async () => {});
  const s = createSession({
    ...platform(),
    quit,
    onCloseRequested(listener) {
      requestClose = listener;
      return () => {};
    },
    saves: { readCandidates: async () => [], write: async () => gate },
  });
  await s.load();
  s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
  let reentrantQuit: Promise<void> | undefined;
  let requested = false;
  const unsubscribe = s.store.subscribe((view) => {
    if (view.closing && !requested) {
      requested = true;
      reentrantQuit = s.quit();
    }
  });
  try {
    const firstClose = requestClose();
    const secondClose = requestClose();
    expect(secondClose).toBe(firstClose);
    const firstQuit = s.quit();
    const secondQuit = s.quit();
    expect(secondQuit).toBe(firstQuit);
    expect(reentrantQuit).toBe(firstQuit);
    expect(s.command({ type: "start" })).toBe(false);
    expect(quit).not.toHaveBeenCalled();
    release();
    await Promise.all([firstClose, secondClose, firstQuit, secondQuit, reentrantQuit]);
    expect(quit).toHaveBeenCalledOnce();
  } finally {
    release();
    unsubscribe();
    await s.dispose();
  }
});

it("keeps browser backups intact when no application validation policy is supplied", async () => {
  const memory = new MemoryStorage();
  const checkpoint = JSON.stringify(run());
  memory.setItem("fauna.save.v1", "unrecognized");
  memory.setItem("fauna.save.v1.backup1", checkpoint);
  const browser = createBrowserPlatform(memory);
  await browser.saves.write("new data");
  expect(memory.getItem("fauna.save.v1.backup1")).toBe(checkpoint);
  expect(memory.getItem("fauna.save.v1.backup2")).toBeNull();
});

it.each(["fauna.save.v1.backup1", "fauna.save.v1.backup2"])(
  "continues saving while preserving unreadable backup %s",
  async (unreadable) => {
    const memory = new MemoryStorage();
    const saved = JSON.stringify(run());
    memory.setItem("fauna.save.v1", saved);
    memory.setItem(unreadable, "unreadable checkpoint");
    const read = memory.getItem.bind(memory);
    memory.getItem = (key) => {
      if (key === unreadable) throw new Error("slot unavailable");
      return read(key);
    };
    const s = createSession(createBrowserPlatform(memory));
    try {
      await s.load();
      expect(s.command({ type: "endTurn" })).toBe(true);
      expect(await s.flush()).toBe(true);
      expect(JSON.parse(read("fauna.save.v1")!).revision).toBe(s.store.getState().game.revision);
      expect(read(unreadable)).toBe("unreadable checkpoint");
      const availableBackup = unreadable.endsWith("backup1") ? "backup2" : "backup1";
      expect(read(`fauna.save.v1.${availableBackup}`)).toBe(saved);
    } finally {
      await s.dispose();
    }
  },
);

it("refuses to overwrite an unreadable primary even when a backup can be loaded", async () => {
  const memory = new MemoryStorage();
  memory.setItem("fauna.save.v1", "unknown primary");
  memory.setItem("fauna.save.v1.backup1", JSON.stringify(run()));
  const read = memory.getItem.bind(memory);
  memory.getItem = (key) => {
    if (key === "fauna.save.v1") throw new Error("primary unavailable");
    return read(key);
  };
  const s = createSession(createBrowserPlatform(memory));
  try {
    await s.load();
    expect(s.command({ type: "endTurn" })).toBe(true);
    expect(await s.flush()).toBe(false);
    expect(read("fauna.save.v1")).toBe("unknown primary");
    expect(read("fauna.save.v1.backup1")).toBe(JSON.stringify(run()));
  } finally {
    await s.dispose();
  }
});

it("isolates throwing presentation subscribers from commands, other subscribers and saving", async () => {
  const p = platform();
  const s = createSession(p);
  await s.load();
  s.store.subscribe(() => {
    throw new Error("presentation failed");
  });
  const observed: number[] = [];
  s.store.subscribe((view) => observed.push(view.game.revision));
  try {
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
    expect(await s.flush()).toBe(true);
    expect(observed).toContain(1);
    expect(JSON.parse((await p.saves.readCandidates())[0]!.data).revision).toBe(1);
    expect(s.diagnostics.snapshot().some((entry) => entry.message === "presentation failed")).toBe(true);
  } finally {
    await s.dispose();
  }
});

it.each(["overlay", "close"])(
  "drains admitted saves and completes cleanup if %s unsubscribe fails",
  async (failed) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const removeOverlay = vi.fn(() => {
      if (failed === "overlay") throw new Error("overlay cleanup failed");
    });
    const removeClose = vi.fn(() => {
      if (failed === "close") throw new Error("close cleanup failed");
    });
    const write = vi.fn(async () => gate);
    const s = createSession({
      ...platform(),
      onOverlay: () => removeOverlay,
      onCloseRequested: () => removeClose,
      saves: { readCandidates: async () => [], write },
    });
    await s.load();
    s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! });
    let finished = false;
    try {
      const disposing = s.dispose();
      void disposing.then(() => {
        finished = true;
      });
      expect(s.dispose()).toBe(disposing);
      expect(removeOverlay).toHaveBeenCalledOnce();
      expect(removeClose).toHaveBeenCalledOnce();
      await Promise.resolve();
      expect(finished).toBe(false);
      expect(s.command({ type: "start" })).toBe(false);
      release();
      await disposing;
      expect(finished).toBe(true);
      expect(write).toHaveBeenCalledOnce();
    } finally {
      release();
    }
  },
);

it("keeps session snapshots immutable across startup, commands and disposal", async () => {
  const s = createSession(platform());
  try {
    expect(Reflect.set(s.store.getInitialState(), "ready", true)).toBe(false);
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(false);
    await s.load();
    s.store.subscribe((view) => {
      Reflect.set(view, "game", s.store.getInitialState().game);
      Reflect.set(view, "closing", false);
    });
    expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
    expect(s.store.getState().game.revision).toBe(1);
    expect(await s.flush()).toBe(true);
    await s.dispose();
    expect(Reflect.set(s.store.getState(), "ready", true)).toBe(false);
    expect(s.store.getState().closing).toBe(true);
  } finally {
    await s.dispose();
  }
});

it("keeps browser diagnostics in the supplied storage profile", async () => {
  const memory = new MemoryStorage();
  memory.setItem(
    "fauna.diagnostics",
    JSON.stringify([{ source: "render", message: "prior failure", count: 1 }]),
  );
  const s = createSession(createBrowserPlatform(memory));
  try {
    expect(s.diagnostics.snapshot()).toContainEqual({ source: "render", message: "prior failure", count: 1 });
    s.diagnostics.record("audio", "playback failed");
    expect(JSON.parse(memory.getItem("fauna.diagnostics")!)).toContainEqual({
      source: "audio",
      message: "playback failed",
      count: 1,
    });
  } finally {
    await s.dispose();
  }
});

it.each(["non-string", "throwing"])(
  "isolates a subscriber throwing an Error with a %s message",
  async (kind) => {
    const p = platform();
    const s = createSession(p);
    await s.load();
    const failure = new Error("failed");
    Object.defineProperty(
      failure,
      "message",
      kind === "throwing"
        ? {
            get() {
              throw new Error("unreadable error");
            },
          }
        : { value: null },
    );
    s.store.subscribe(() => {
      throw failure;
    });
    const observed: number[] = [];
    s.store.subscribe((view) => observed.push(view.game.revision));
    try {
      expect(s.command({ type: "draft", species: s.store.getState().game.starterOffers[0]! })).toBe(true);
      expect(await s.flush()).toBe(true);
      expect(observed).toContain(1);
      expect(JSON.parse((await p.saves.readCandidates())[0]!.data).revision).toBe(1);
      expect(s.diagnostics.snapshot()).toContainEqual(
        expect.objectContaining({ source: "render", message: "Unknown failure" }),
      );
    } finally {
      await s.dispose();
    }
  },
);

it.each(["timeout", "dispose"] as const)(
  "does not retry a late save-read failure after %s",
  async (ending) => {
    vi.useFakeTimers();
    let rejectRead!: (error: Error) => void;
    const p = platform();
    p.saves.readCandidates = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<Platform["saves"]["readCandidates"]>>>((_, reject) => {
          rejectRead = reject;
        }),
    );
    const s = createSession(p);
    try {
      const loading = s.load();
      await vi.advanceTimersByTimeAsync(0);
      if (ending === "timeout") {
        await vi.advanceTimersByTimeAsync(5000);
        await loading;
        expect(s.store.getState().ready).toBe(true);
      } else await s.dispose();
      rejectRead(new Error("late read failure"));
      await vi.advanceTimersByTimeAsync(0);
      expect(p.saves.readCandidates).toHaveBeenCalledTimes(1);
      await loading;
    } finally {
      await s.dispose();
      vi.useRealTimers();
    }
  },
);

it("retains distinct recovery checkpoints after loading a backup and retrying saves", async () => {
  const memory = new MemoryStorage();
  const older = JSON.stringify({ ...run(), revision: 10 });
  const newer = JSON.stringify({ ...run(), revision: 11 });
  memory.setItem("fauna.save.v1", "broken");
  memory.setItem("fauna.save.v1.backup1", newer);
  memory.setItem("fauna.save.v1.backup2", older);
  const browser = createBrowserPlatform(memory);
  const recoverable = (data: string) => data === newer || data === older;
  await browser.saves.write(newer, recoverable);
  await browser.saves.write(newer, recoverable);
  expect(memory.getItem("fauna.save.v1.backup1")).toBe(newer);
  expect(memory.getItem("fauna.save.v1.backup2")).toBe(older);
});

it("explains consecutive save failures, preserves play and clears the notice after the latest state saves", async () => {
  vi.useFakeTimers();
  let failing = true;
  let saved = "";
  const write = vi.fn(async (data: string) => {
    if (failing) throw new Error("disk full");
    saved = data;
  });
  const session = createSession({
    ...platform(JSON.stringify(run())),
    saves: { readCandidates: async () => [{ source: "primary", data: JSON.stringify(run()) }], write },
  });
  try {
    await session.load();
    expect(session.command({ type: "endTurn" })).toBe(true);
    await session.flush();
    const committed = session.store.getState().game;
    expect(session.store.getState().saveUnavailable).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    await session.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(session.store.getState().saveUnavailable).toBe(true);
    expect(session.store.getState().game).toBe(committed);
    failing = false;
    expect(session.command({ type: "endTurn" })).toBe(true);
    expect(await session.flush()).toBe(true);
    expect(session.store.getState().saveUnavailable).toBe(false);
    expect(JSON.parse(saved)).toEqual(session.store.getState().game);
    await vi.advanceTimersByTimeAsync(5000);
    expect(write).toHaveBeenCalledTimes(3);
  } finally {
    await session.dispose();
    vi.useRealTimers();
  }
});
