import { afterEach, expect, it, vi } from "vitest";
import { createCloud } from "../../../src/application/cloud";
import { cloudName, snapshot } from "../../../src/application/cloud-snapshots";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { createSession } from "../../../src/application/session";
import { draw, drawKeyword } from "../../../src/game/card-zones";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { createGame } from "../../../src/game/engine";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { installPerformanceRecorder, startPerformanceSpan } from "../../../src/lib/performance";
import type { CloudPort } from "../../../src/platform/ports";
import { prepareDestination, run } from "../../support/game";

const identity = {
  available: true,
  device: "a".repeat(32),
  profile: "b".repeat(32),
  importAvailable: false,
};
const initial = encodeSave(decodeSave(encodeSave(createGame(3))));
const progress = encodeSave(decodeSave(encodeSave(createGame(7))));
function cloudFixture() {
  const files = new Map<string, string>();
  const local = { data: null as string | null };
  const port: CloudPort = {
    identity: vi.fn(async () => identity),
    readLocal: async () => local.data,
    writeLocal: vi.fn(async (data) => {
      local.data = data;
    }),
    preserve: vi.fn(async () => {}),
    importStandalone: vi.fn(async () => [{ source: "standalone", data: progress }]),
    list: async () => [...files.keys()],
    read: async (name) => files.get(name) ?? null,
    write: async (name, data) => {
      files.set(name, data);
    },
  };
  const install = vi.fn(async (_data: string, _owns?: () => boolean) => {});
  const manager = createCloud(port, () => {}, install);
  return { manager, port, local, files, install };
}
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
afterEach(() => {
  vi.useRealTimers();
});

it("1: zero-strength harmful applications retain Nullify, Reflect and RNG", () => {
  const state = structuredClone(run());
  const source = state.team[0]!;
  const target = state.battle!.enemies[0]!;
  target.combat.nullify = true;
  target.combat.reflect = true;
  const before = encodeSave(state);
  const events: import("../../../src/game/types").GameEvent[] = [];
  resolveCombat("applyHarmfulStatus", state, source, target, 0, "stun", events);
  expect(encodeSave(state)).toBe(before);
  expect(events).toEqual([]);
});

it("2: a fallen source cannot apply new harmful effects", () => {
  const state = structuredClone(run());
  const source = state.team[0]!;
  source.health = 0;
  const target = state.battle!.enemies[0]!;
  const before = encodeSave(state);
  resolveCombat("applyBlind", state, source, target, []);
  resolveCombat("applyHarmfulStatus", state, source, target, 4, "poison", []);
  expect(encodeSave(state)).toBe(before);
});

it("3: an empty keyword draw has no hidden decision to make its forecast unknown", () => {
  const state = structuredClone(run());
  state.battle!.draw = [];
  state.battle!.discard = [];
  const decision = vi.fn(() => {
    throw new Error("Unexpected hidden decision");
  });
  observeDecisions(state, decision);
  expect(() => drawKeyword(state, "burn")).not.toThrow();
  expect(decision).not.toHaveBeenCalled();
});

it("4: drawing zero cards cannot shuffle Discard or promote buffered cards", () => {
  const state = structuredClone(run());
  state.battle!.draw = [];
  state.battle!.discard = state.battle!.hand.splice(0);
  const before = encodeSave(state);
  expect(draw(state, 0)).toBe(0);
  expect(encodeSave(state)).toBe(before);
});

it("5: snapshot construction rejects identities and sequence counters it cannot read back", async () => {
  await expect(snapshot(initial, identity, 0)).rejects.toThrow();
  await expect(snapshot(initial, identity, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow();
  await expect(snapshot(initial, { ...identity, device: "invalid" }, 1)).rejects.toThrow();
});

it("6: Cloud snapshots cannot claim another profile's progress as ancestry", async () => {
  const parent = await snapshot(initial, { ...identity, profile: "c".repeat(32) }, 1);
  await expect(snapshot(progress, identity, 2, [parent])).rejects.toThrow("another profile");
});

it("7: Cloud reconciliation cannot silently truncate a direct competing head", async () => {
  const base = await snapshot(initial, identity, 1);
  const heads = Array.from({ length: 65 }, (_, i) => ({ ...base, id: i.toString(16).padStart(64, "0") }));
  await expect(snapshot(progress, identity, 2, heads)).rejects.toThrow("ancestry limit");
});

it("8: startup preserves unmatched valid local metadata before replacing it", async () => {
  const f = cloudFixture();
  const retained = await snapshot(progress, identity, 9);
  f.local.data = JSON.stringify(retained);
  const order: string[] = [];
  f.port.preserve = vi.fn(async (records) => {
    expect(records).toContain(JSON.stringify(retained));
    order.push("preserved");
  });
  f.port.writeLocal = async (data) => {
    order.push("written");
    f.local.data = data;
  };
  try {
    await f.manager.start(initial);
    await f.manager.flush();
    expect(order.slice(0, 2)).toEqual(["preserved", "written"]);
  } finally {
    await f.manager.dispose();
  }
});

it("9: an explicit Cloud retry recovers a failed identity lookup", async () => {
  const f = cloudFixture();
  f.port.identity = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(identity);
  try {
    await f.manager.start(initial);
    expect(f.manager.view.status).toBe("Pending");
    await f.manager.retry();
    await f.manager.flush();
    expect(f.port.identity).toHaveBeenCalledTimes(2);
    expect(f.manager.view.status).toBe("Synced");
  } finally {
    await f.manager.dispose();
  }
});

it("10: a stale standalone-import offer cannot replace intact profile progress", async () => {
  const f = cloudFixture();
  f.port.identity = async () => ({ ...identity, importAvailable: true });
  try {
    await f.manager.start(initial);
    expect(f.port.importStandalone).not.toHaveBeenCalled();
    expect(f.install).not.toHaveBeenCalled();
    expect(JSON.parse(f.local.data!).payload).toBe(initial);
  } finally {
    await f.manager.dispose();
  }
});

it("11: a stalled Cloud installation releases startup and cannot publish after offline play", async () => {
  vi.useFakeTimers();
  const f = cloudFixture();
  const remote = await snapshot(progress, { ...identity, device: "c".repeat(32) }, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  const gate = deferred();
  let published = false;
  f.install.mockImplementation(async (_data, owns) => {
    await gate.promise;
    if (owns?.()) published = true;
  });
  try {
    const starting = f.manager.start(null);
    await vi.waitFor(() => expect(f.install).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(5000);
    await starting;
    expect(f.manager.view.blocking).toBe(false);
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(published).toBe(false);
  } finally {
    gate.resolve();
    await f.manager.dispose();
  }
});

it("12: an older upload cannot report Synced while newer local metadata is still pending", async () => {
  const f = cloudFixture();
  const upload = deferred();
  const uploaded = deferred();
  const write = f.port.write;
  f.port.write = async (name, data) => {
    uploaded.resolve();
    await upload.promise;
    await write(name, data);
  };
  const acknowledged = deferred();
  f.port.acknowledge = async () => {
    acknowledged.resolve();
  };
  const metadata = deferred();
  try {
    await f.manager.start(initial);
    await uploaded.promise;
    f.port.writeLocal = async () => metadata.promise;
    const committed = f.manager.commit(progress);
    await new Promise<void>((resolve) => setImmediate(resolve));
    upload.resolve();
    await acknowledged.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.manager.view.status).toBe("Syncing");
    metadata.resolve();
    await committed;
  } finally {
    upload.resolve();
    metadata.resolve();
    await f.manager.dispose();
  }
});

it("13: intact local Cloud metadata recovers progress when all gameplay slots are missing", async () => {
  const f = cloudFixture();
  const retained = await snapshot(progress, identity, 9);
  f.local.data = JSON.stringify(retained);
  try {
    await f.manager.start(null);
    await f.manager.flush();
    expect(f.install).toHaveBeenCalledWith(progress, expect.any(Function));
    expect(JSON.parse(f.local.data!).payload).toBe(progress);
    expect(f.manager.view.status).toBe("Synced");
  } finally {
    await f.manager.dispose();
  }
});

it("14: live and restored diagnostic context redact paths and credentials", () => {
  let data: string | null = null;
  const port = {
    read: () => data,
    write: (value: string) => {
      data = value;
    },
  };
  const diagnostics = createDiagnostics(port);
  diagnostics.record("global", "failure", { revision: 1, phase: "token=private-credential" });
  expect(data).not.toContain("private-credential");
  data = JSON.stringify([
    { source: "global", message: "failure", count: 1, revision: 1, phase: "/Users/private-user/Saves/" },
  ]);
  expect(JSON.stringify(createDiagnostics(port).snapshot())).not.toContain("private-user");
});

it("15: diagnostic subscriptions added during notification wait for the next record", () => {
  const diagnostics = createDiagnostics();
  const added = vi.fn();
  diagnostics.subscribe(() => {
    diagnostics.subscribe(added);
  });
  diagnostics.record("global", "first");
  expect(added).not.toHaveBeenCalled();
  diagnostics.record("global", "second");
  expect(added).toHaveBeenCalledOnce();
});

it("16: malformed diagnostic context cannot throw or suppress the original failure", () => {
  const diagnostics = createDiagnostics();
  const context = {
    revision: 1,
    get phase(): string {
      throw new Error("bad context");
    },
  };
  expect(() => diagnostics.record("global", "original failure", context)).not.toThrow();
  expect(diagnostics.snapshot()[0]?.message).toBe("original failure");
});

it("17: disposing a nested performance recorder restores the still-active outer recorder", () => {
  const outer = vi.fn();
  const inner = vi.fn();
  const removeOuter = installPerformanceRecorder(outer);
  const removeInner = installPerformanceRecorder(inner);
  try {
    startPerformanceSpan("inner")();
    removeInner();
    startPerformanceSpan("outer")();
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).toHaveBeenCalledOnce();
  } finally {
    removeInner();
    removeOuter();
  }
});

it("18: a draft cannot carry journey-only Boons into a new journey", () => {
  const state = structuredClone(createGame(3));
  state.boons = ["tattered-pages"];
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

it("19: an ongoing journey with a fully fallen roster uses recovery instead of resuming", () => {
  const state = structuredClone(run());
  prepareDestination(state);
  for (const unit of [...state.team, ...state.reserves]) unit.health = 0;
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

it("20: active control cannot resume with buildup that its own threshold already consumed", () => {
  const state = structuredClone(run());
  const stats = state.team[0]!.combat!;
  stats.controlled = "stun";
  stats.controlTurns = 1;
  stats.stun = 5;
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

it("subscriptions have independent ownership and teardown revokes admission", async () => {
  const diagnostics = createDiagnostics();
  const listener = vi.fn();
  const removeFirst = diagnostics.subscribe(listener);
  diagnostics.subscribe(listener);
  removeFirst();
  diagnostics.record("global", "failure");
  expect(listener).toHaveBeenCalledOnce();
  diagnostics.dispose();
  const session = createSession({
    desktop: false,
    steam: { available: false },
    saves: { readCandidates: async () => [], write: async () => {} },
  });
  await session.load();
  const late = vi.fn();
  const closing = vi.fn();
  let disposing: Promise<void> | undefined;
  session.store.subscribe((view) => {
    if (view.game.revision === 1 && !disposing) {
      disposing = session.dispose();
      session.store.subscribe(late);
    }
  });
  session.store.subscribe((view) => {
    if (view.closing) closing();
  });
  session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! });
  await disposing;
  expect(closing).toHaveBeenCalledOnce();
  expect(late).not.toHaveBeenCalled();
});

it("expired Cloud installation cannot replace the session's newer offline commands", async () => {
  vi.useFakeTimers();
  const f = cloudFixture();
  const remote = await snapshot(progress, { ...identity, device: "c".repeat(32) }, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  const gate = deferred();
  const entered = deferred();
  const saves: string[] = [];
  const session = createSession({
    desktop: false,
    steam: { available: false },
    cloud: f.port,
    saves: {
      readCandidates: async () => [],
      write: async (data) => {
        if (!saves.length) {
          entered.resolve();
          await gate.promise;
        }
        saves.push(data);
      },
    },
  });
  try {
    const loading = session.load();
    await vi.waitFor(() => expect(f.port.preserve).toHaveBeenCalled());
    await entered.promise;
    await vi.advanceTimersByTimeAsync(5000);
    await loading;
    expect(session.store.getState().ready).toBe(true);
    const before = session.store.getState().game;
    expect(session.command({ type: "draft", species: before.starterOffers[0]! })).toBe(true);
    const committed = session.store.getState().game;
    gate.resolve();
    await session.flush();
    expect(session.store.getState().game).toBe(committed);
    expect(decodeSave(saves.at(-1)!)).toEqual(committed);
  } finally {
    gate.resolve();
    await session.dispose();
    await f.manager.dispose();
  }
});

it("unmatched metadata is not overwritten when preserving its alternative fails", async () => {
  const f = cloudFixture();
  const retained = await snapshot(progress, identity, 9);
  f.local.data = JSON.stringify(retained);
  f.port.preserve = async () => {
    throw new Error("disk full");
  };
  try {
    await f.manager.start(initial);
    expect(f.local.data).toBe(JSON.stringify(retained));
    expect(f.port.writeLocal).not.toHaveBeenCalled();
    expect(f.manager.view.status).toBe("Pending");
  } finally {
    await f.manager.dispose();
  }
});
