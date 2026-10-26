import { expect, it, vi } from "vitest";
import { createCloud } from "../../../src/application/cloud";
import { parseSnapshot } from "../../../src/application/cloud-snapshots";
import { createSession } from "../../../src/application/session";
import { createGame, dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { CloudPort } from "../../../src/platform/ports";

const initial = encodeSave(decodeSave(encodeSave(createGame(3))));
const progress = encodeSave(
  decodeSave(
    encodeSave(dispatch(createGame(3), { type: "draft", species: createGame(3).starterOffers[0]! }).state),
  ),
);

function cloudFixture() {
  const files = new Map<string, string>();
  let local: string | null = null;
  const port: CloudPort = {
    identity: vi.fn(async () => ({
      available: true,
      device: "a".repeat(32),
      profile: "b".repeat(32),
      importAvailable: false,
    })),
    readLocal: async () => local,
    writeLocal: async (data) => {
      local = data;
    },
    preserve: async () => {},
    importStandalone: async () => [],
    list: vi.fn(async () => [...files.keys()]),
    read: async (name) => files.get(name) ?? null,
    write: async (name, data) => {
      files.set(name, data);
    },
  };
  const install = vi.fn(async (_data: string) => {});
  const manager = createCloud(port, () => {}, install);
  return { port, manager, install, local: () => local };
}

it("delivers reentrant session commands to every subscriber in commit order", async () => {
  const saved: number[] = [];
  const session = createSession({
    desktop: false,
    steam: { available: false },
    saves: {
      readCandidates: async () => [],
      write: async (data) => {
        saved.push(JSON.parse(data).revision);
      },
    },
  });
  try {
    await session.load();
    let reentrantAccepted = false;
    session.store.subscribe((view, previous) => {
      if (view.game.revision === 1 && previous.game.revision === 0)
        reentrantAccepted = session.command({ type: "start" });
    });
    const observed: number[] = [];
    session.store.subscribe((view, previous) => {
      if (view.game !== previous.game) observed.push(view.game.revision);
    });
    expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
      true,
    );
    await session.flush();
    expect(reentrantAccepted).toBe(true);
    expect(observed).toEqual([1, 2]);
    expect(saved).toEqual([1, 2]);
  } finally {
    await session.dispose();
  }
});

it("shares Cloud startup ownership across concurrent and later callers", async () => {
  const f = cloudFixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const identity = f.port.identity;
  f.port.identity = vi.fn(async () => {
    await gate;
    return identity();
  });
  try {
    const first = f.manager.start(initial);
    const second = f.manager.start(initial);
    release();
    await Promise.all([first, second]);
    expect(f.port.identity).toHaveBeenCalledOnce();
    await f.manager.commit(progress);
    await f.manager.flush();
    await f.manager.start(initial);
    await f.manager.flush();
    expect(f.port.identity).toHaveBeenCalledOnce();
    expect((await parseSnapshot(f.local()!, "b".repeat(32))).payload).toBe(progress);
    expect(f.install).not.toHaveBeenCalled();
  } finally {
    release();
    await f.manager.dispose();
  }
});

it("cancels an obsolete Cloud retry after successful reconciliation", async () => {
  vi.useFakeTimers();
  const f = cloudFixture();
  const list = f.port.list;
  f.port.list = vi.fn(async () => {
    throw new Error("offline");
  });
  try {
    await f.manager.start(initial);
    expect(f.manager.view.status).toBe("Pending");
    f.port.list = vi.fn(list);
    await f.manager.retry();
    await f.manager.flush();
    expect(f.manager.view.status).toBe("Synced");
    const reads = vi.mocked(f.port.list).mock.calls.length;
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.port.list).toHaveBeenCalledTimes(reads);
    expect(f.manager.view.status).toBe("Synced");
  } finally {
    await f.manager.dispose();
    vi.useRealTimers();
  }
});
