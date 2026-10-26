import { expect, it, vi } from "vitest";
import { createCloud } from "../../../src/application/cloud";
import { snapshot, parseSnapshot, cloudName } from "../../../src/application/cloud-snapshots";
import { newestHeads } from "../../../src/application/cloud-policy";
import { createGame, dispatch } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import type { CloudIdentity, CloudPort } from "../../../src/platform/ports";
const identity: CloudIdentity = {
  available: true,
  device: "a".repeat(32),
  profile: "b".repeat(32),
  importAvailable: false,
};
const other = { ...identity, device: "c".repeat(32) };
const initial = encodeSave(decodeSave(encodeSave(createGame(3))));
const progress = encodeSave(
  decodeSave(
    encodeSave(dispatch(createGame(7), { type: "draft", species: createGame(7).starterOffers[0]! }).state),
  ),
);
it("keeps published cloud status immutable so consumers cannot change retry decisions", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.port.list = vi.fn(async () => {
    throw new Error("offline");
  });
  const mutations: boolean[] = [];
  const manager = createCloud(
    f.port,
    (view) => {
      mutations.push(Reflect.set(view, "status", "Synced"));
    },
    f.install,
  );
  try {
    expect(Reflect.set(manager.view, "blocking", true)).toBe(false);
    await manager.start(initial);
    expect(manager.view.status).toBe("Pending");
    expect(Reflect.set(manager.view, "status", "Synced")).toBe(false);
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every((changed) => !changed)).toBe(true);
    const reads = vi.mocked(f.port.list).mock.calls.length;
    await vi.advanceTimersByTimeAsync(15000);
    expect(vi.mocked(f.port.list).mock.calls.length).toBeGreaterThan(reads);
  } finally {
    await manager.dispose();
    await f.manager.dispose();
    vi.useRealTimers();
  }
});
function fixture() {
  const files = new Map<string, string>(),
    local = { data: null as string | null };
  const preserve = vi.fn(async (_records: string[]) => {});
  const port: CloudPort = {
    identity: async () => identity,
    readLocal: async () => local.data,
    writeLocal: async (data) => {
      local.data = data;
    },
    preserve,
    importStandalone: async () => [],
    list: async () => [...files.keys()],
    read: async (name) => files.get(name) ?? null,
    write: async (name, data) => {
      files.set(name, data);
    },
  };
  const install = vi.fn(async (_data: string) => {});
  const manager = createCloud(port, () => {}, install);
  return { manager, port, files, local, install, preserve };
}
it.each(["offline", "dispose"] as const)(
  "does not begin an identity lookup after a startup subscriber requests %s",
  async (action) => {
    const f = fixture();
    const identify = (f.port.identity = vi.fn(f.port.identity));
    let manager!: ReturnType<typeof createCloud>;
    manager = createCloud(
      f.port,
      (view) => {
        if (view.status === "Syncing") {
          if (action === "offline") manager.offline();
          else void manager.dispose();
        }
      },
      f.install,
    );
    try {
      await manager.start(initial);
      expect(identify).not.toHaveBeenCalled();
      expect(f.local.data).toBeNull();
      expect(f.install).not.toHaveBeenCalled();
    } finally {
      await manager.dispose();
      await f.manager.dispose();
    }
  },
);
it.each(["offline", "dispose"] as const)(
  "does not begin an upload after a syncing subscriber requests %s",
  async (action) => {
    const f = fixture();
    const write = (f.port.write = vi.fn(f.port.write));
    let armed = false;
    let syncing = 0;
    let manager!: ReturnType<typeof createCloud>;
    manager = createCloud(
      f.port,
      (view) => {
        if (armed && view.status === "Syncing" && ++syncing === 2) {
          armed = false;
          if (action === "offline") manager.offline();
          else void manager.dispose();
        }
      },
      f.install,
    );
    try {
      await manager.start(null);
      armed = true;
      await manager.commit(progress);
      await manager.flush();
      expect(write).not.toHaveBeenCalled();
      expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
    } finally {
      await manager.dispose();
      await f.manager.dispose();
    }
  },
);
it("round-trips valid snapshots and rejects changed payload bytes or another profile", async () => {
  const s = await snapshot(initial, identity, 1);
  expect(await parseSnapshot(JSON.stringify(s), identity.profile)).toEqual(s);
  await expect(
    parseSnapshot(JSON.stringify({ ...s, payload: progress }), identity.profile),
  ).rejects.toThrow();
  await expect(parseSnapshot(JSON.stringify(s), "wrong-account")).rejects.toThrow();
});
it("publishes only validated immutable snapshot fields", async () => {
  const parent = await snapshot(initial, identity, 1);
  const child = await snapshot(progress, identity, 2, [parent]);
  const parsed = await parseSnapshot(
    JSON.stringify({ ...child, unchecked: { payload: "unvalidated data" } }),
    identity.profile,
  );

  expect(parsed).toEqual(child);
  expect(Reflect.set(parsed, "sequence", 100)).toBe(false);
  expect(Reflect.set(parsed.ancestors, "0", "d".repeat(64))).toBe(false);
  expect(parsed.ancestors).toEqual([parent.id]);
});
it.each([null, [], true, 1, "metadata", {}])("rejects a non-snapshot JSON value: %j", async (value) => {
  await expect(parseSnapshot(JSON.stringify(value), identity.profile)).rejects.toThrow(
    "Invalid cloud metadata",
  );
});
it.each([
  ["device", { device: "d".repeat(32) }],
  ["sequence", { sequence: 2 }],
  ["ancestors", { ancestors: ["d".repeat(64)] }],
  ["payload hash", { hash: "d".repeat(64) }],
  ["snapshot identity", { id: "d".repeat(64) }],
] as const)("rejects well-formed %s tampering against the snapshot signature", async (_field, patch) => {
  const s = await snapshot(initial, identity, 1);
  expect(await parseSnapshot(JSON.stringify(s), identity.profile)).toEqual(s);
  await expect(parseSnapshot(JSON.stringify({ ...s, ...patch }), identity.profile)).rejects.toThrow(
    "Cloud snapshot failed validation",
  );
});
it.each([
  ["obsolete version", { version: 0 }],
  ["invalid device", { device: "unknown" }],
  ["zero sequence", { sequence: 0 }],
  ["fractional sequence", { sequence: 1.5 }],
  ["unsafe sequence", { sequence: Number.MAX_SAFE_INTEGER + 1 }],
  ["non-string hash", { hash: ["d".repeat(64)] }],
  ["non-string payload", { payload: {} }],
  ["non-string ancestor", { ancestors: [1] }],
  ["duplicate ancestors", { ancestors: ["d".repeat(64), "d".repeat(64)] }],
  [
    "unbounded ancestry",
    { ancestors: Array.from({ length: 65 }, (_, i) => i.toString(16).padStart(64, "0")) },
  ],
] as const)("rejects %s metadata", async (_field, patch) => {
  const s = await snapshot(initial, identity, 1);
  await expect(parseSnapshot(JSON.stringify({ ...s, ...patch }), identity.profile)).rejects.toThrow(
    "Invalid cloud metadata",
  );
});
it("rejects snapshots that list themselves as an ancestor", async () => {
  const s = await snapshot(initial, identity, 1);
  await expect(parseSnapshot(JSON.stringify({ ...s, ancestors: [s.id] }), identity.profile)).rejects.toThrow(
    "Invalid cloud metadata",
  );
});
it("uploads only after durable local metadata, keeping devices in distinct slots", async () => {
  const f = fixture();
  const remote = await snapshot(initial, other, 4);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  let entered!: () => void;
  const writing = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.port.writeLocal = async (data) => {
    entered();
    await gate;
    f.local.data = data;
  };
  const starting = f.manager.start(null);
  try {
    await writing;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.local.data).toBeNull();
    expect(f.files).toEqual(new Map([[cloudName(remote), JSON.stringify(remote)]]));
    release();
    await starting;
    await f.manager.flush();
    expect(f.install).toHaveBeenCalledWith(initial, expect.any(Function));
    expect(f.files.get(cloudName(remote))).toBe(JSON.stringify(remote));
    const local = await parseSnapshot(f.local.data!, identity.profile);
    expect(local.payload).toBe(initial);
    expect(f.files.get(cloudName(local))).toBe(JSON.stringify(local));
    expect(f.manager.view.status).toBe("Synced");
  } finally {
    release();
    await starting;
    await f.manager.dispose();
  }
});
it("preserves divergent heads and automatically retains local progress without merging currency", async () => {
  const f = fixture();
  const local = encodeSave({ ...decodeSave(initial), currency: 20 });
  const remoteProgress = encodeSave({ ...decodeSave(progress), currency: 40 });
  const remote = await snapshot(remoteProgress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.start(local);
  expect(f.preserve).toHaveBeenCalled();
  expect(f.install).not.toHaveBeenCalled();
  await f.manager.flush();
  expect(f.manager.view.blocking).toBe(false);
  const resolved = await parseSnapshot(f.local.data!, identity.profile);
  expect(resolved.payload).toBe(local);
  expect(decodeSave(resolved.payload).currency).toBe(20);
  expect(f.preserve.mock.calls.flatMap(([records]) => records.map((record) => JSON.parse(record)))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ payload: local }),
      expect.objectContaining({ payload: remoteProgress }),
    ]),
  );
  expect(f.files.get(cloudName(remote))).toBe(JSON.stringify(remote));
  expect(resolved.ancestors).toContain(remote.id);
  expect(newestHeads([resolved, remote])).toEqual([resolved]);
  f.manager.dispose();
});
it("keeps unknown remote progress intact during outages and permits explicit offline play", async () => {
  const f = fixture();
  f.port.list = async () => {
    throw new Error("offline");
  };
  await f.manager.start(initial);
  expect(f.manager.view.status).toBe("Pending");
  expect(f.files.size).toBe(0);
  f.manager.offline();
  await f.manager.commit(progress);
  expect(f.manager.view.blocking).toBe(false);
  expect(f.files.size).toBe(0);
  expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
  f.manager.dispose();
});
it.each(["offline", "dispose"] as const)("does not install a late read after %s", async (action) => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let entered!: () => void;
  const reading = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.port.list = async () => {
    entered();
    await gate;
    return [...f.files.keys()];
  };
  const start = f.manager.start(null);
  await reading;
  if (action === "offline") expect(f.manager.offline()).toBe(true);
  else await f.manager.dispose();
  release();
  await start;
  expect(f.install).not.toHaveBeenCalled();
  expect(f.local.data).toBeNull();
  expect(f.files).toEqual(new Map([[cloudName(remote), JSON.stringify(remote)]]));
  await f.manager.dispose();
});
it("refuses replacement when durable conflict preservation fails", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  f.port.preserve = async () => {
    throw new Error("disk full");
  };
  await f.manager.start(initial);
  expect(f.manager.view.blocking).toBe(false);
  expect(f.install).not.toHaveBeenCalled();
  expect(f.files.size).toBe(1);
  f.manager.dispose();
});
it("falls back to a valid remote recovery slot and pauses uploads if another slot is invalid", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  f.files.set(cloudName({ device: other.device, sequence: 2 }), "corrupt");
  await f.manager.start(null);
  expect(f.install).toHaveBeenCalledWith(progress, expect.any(Function));
  expect(f.manager.view.status).toBe("Pending");
  expect(f.files.size).toBe(2);
  f.manager.dispose();
});
it("does not upload after failed local metadata persistence", async () => {
  const f = fixture();
  await f.manager.start(null);
  f.port.writeLocal = async () => {
    throw new Error("disk full");
  };
  await f.manager.commit(progress);
  expect(f.manager.view.status).toBe("Pending");
  expect(f.files.size).toBe(0);
  f.manager.dispose();
});
it("automatically installs a proven descendant and retains its ancestry", async () => {
  const f = fixture();
  const ancestor = await snapshot(initial, identity, 1);
  f.local.data = JSON.stringify(ancestor);
  const remote = await snapshot(progress, other, 1, [ancestor]);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.start(initial);
  await f.manager.flush();
  expect(f.install).toHaveBeenCalledWith(progress, expect.any(Function));
  expect(f.manager.view.status).toBe("Synced");
  const resolved = await parseSnapshot(f.local.data!, identity.profile);
  expect(resolved.payload).toBe(progress);
  expect(resolved.ancestors).toEqual(expect.arrayContaining([ancestor.id, remote.id]));
  expect(newestHeads([ancestor, remote, resolved])).toEqual([resolved]);
  f.manager.dispose();
});
it("continues locally when automatic installation fails and retries safely", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  f.install.mockRejectedValueOnce(new Error("disk full"));
  await f.manager.start(null);
  expect(f.manager.view.status).toBe("Pending");
  expect(f.manager.view.blocking).toBe(false);
  await f.manager.retry();
  expect(f.install).toHaveBeenLastCalledWith(progress, expect.any(Function));
  expect(f.manager.view.blocking).toBe(false);
  await f.manager.flush();
  f.manager.dispose();
});
it("automatically continues locally after a startup timeout and ignores late remote results", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    let release!: () => void;
    f.port.identity = async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return identity;
    };
    const start = f.manager.start(null);
    await vi.advanceTimersByTimeAsync(5000);
    await start;
    expect(f.manager.view.blocking).toBe(false);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.install).not.toHaveBeenCalled();
    f.manager.dispose();
  } finally {
    vi.useRealTimers();
  }
});
it("retries sync silently without replacing a journey already being played", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    f.port.list = async () => {
      throw new Error("offline");
    };
    await f.manager.start(initial);
    await f.manager.commit(progress);
    const remote = await snapshot(initial, other, 3);
    f.files.set(cloudName(remote), JSON.stringify(remote));
    f.port.list = async () => [...f.files.keys()];
    await vi.advanceTimersByTimeAsync(15000);
    await f.manager.flush();
    expect(f.manager.view.blocking).toBe(false);
    expect(f.install).not.toHaveBeenCalled();
    await vi.waitFor(async () => {
      const resolved = await parseSnapshot(f.local.data!, identity.profile);
      expect(resolved.payload).toBe(progress);
      expect(resolved.ancestors).toContain(remote.id);
    });
    await f.manager.flush();
    expect(f.preserve).toHaveBeenCalled();
    expect(f.files.get(cloudName(remote))).toBe(JSON.stringify(remote));
    f.manager.dispose();
  } finally {
    vi.useRealTimers();
  }
});
it("automatically adopts a valid standalone backup without changing the original", async () => {
  const f = fixture();
  f.port.identity = async () => ({ ...identity, importAvailable: true });
  const original = [
    { source: "primary", data: "broken" },
    { source: "backup", data: progress },
  ];
  f.port.importStandalone = vi.fn(async () => original);
  await f.manager.start(null);
  expect(f.install).toHaveBeenCalledWith(progress, expect.any(Function));
  expect(original[0]!.data).toBe("broken");
  expect(f.manager.view.blocking).toBe(false);
  await f.manager.flush();
  f.manager.dispose();
});
it("serializes retry metadata with newer commits", async () => {
  const f = fixture();
  await f.manager.start(null);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = f.port.writeLocal;
  const calls: string[] = [];
  f.port.writeLocal = async (data) => {
    calls.push(data);
    if (calls.length === 1) await gate;
    await original(data);
  };
  const first = f.manager.commit(initial);
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  const second = f.manager.commit(progress);
  // Snapshot hashing finishes asynchronously, but the first write still owns the lane.
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(calls).toHaveLength(1);
  release();
  await Promise.all([first, second]);
  expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
  await f.manager.dispose();
});

it("retries metadata for the latest local progress without installing an older checkpoint", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    await f.manager.start(initial);
    await f.manager.flush();
    const write = f.port.writeLocal;
    f.port.writeLocal = async () => {
      throw new Error("full");
    };
    await f.manager.commit(progress);
    f.port.writeLocal = write;
    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(async () => {
      expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
    });
    expect(f.install).not.toHaveBeenCalled();
    await f.manager.flush();
    await f.manager.dispose();
  } finally {
    vi.useRealTimers();
  }
});

it("retries a failed identity lookup and syncs the journey played offline", async () => {
  vi.useFakeTimers();
  const f = fixture();
  try {
    f.port.identity = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(identity);
    await f.manager.start(initial);
    await f.manager.commit(progress);
    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(async () => {
      expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
      expect(f.files.size).toBeGreaterThan(0);
    });
    expect(f.install).not.toHaveBeenCalled();
    expect(f.manager.view.blocking).toBe(false);
  } finally {
    await f.manager.dispose();
    vi.useRealTimers();
  }
});

it("recovers local metadata before retrying uploads after a startup read failure", async () => {
  vi.useFakeTimers();
  const f = fixture();
  try {
    const ancestor = await snapshot(initial, identity, 20);
    f.local.data = JSON.stringify(ancestor);
    f.files.set(cloudName(ancestor), JSON.stringify(ancestor));
    f.port.readLocal = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk busy"))
      .mockImplementation(async () => JSON.stringify(ancestor));
    await f.manager.start(initial);
    await f.manager.commit(progress);
    expect(f.local.data).toBe(JSON.stringify(ancestor));
    await vi.advanceTimersByTimeAsync(15000);
    await vi.waitFor(async () => {
      const saved = await parseSnapshot(f.local.data!, identity.profile);
      expect(saved.sequence).toBeGreaterThan(20);
      expect(saved.payload).toBe(progress);
      expect(f.manager.view.status).toBe("Synced");
    });
    expect(f.port.readLocal).toHaveBeenCalledTimes(2);
    expect(f.install).not.toHaveBeenCalled();
  } finally {
    await f.manager.dispose();
    vi.useRealTimers();
  }
});

it("retains every direct conflict head when parent ancestry fills the history limit", async () => {
  let parent = await snapshot(initial, identity, 1);
  for (let sequence = 2; sequence <= 65; sequence++)
    parent = await snapshot(initial, identity, sequence, [parent]);
  const competing = await snapshot(progress, other, 1);
  const resolved = await snapshot(initial, identity, 66, [parent, competing]);
  expect(resolved.ancestors).toHaveLength(64);
  expect(resolved.ancestors).toContain(parent.id);
  expect(resolved.ancestors).toContain(competing.id);
  expect(newestHeads([parent, competing, resolved])).toEqual([resolved]);
});

it("flush waits for admitted hashing, metadata and the resulting upload", async () => {
  const f = fixture();
  await f.manager.start(null);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = f.port.write;
  f.port.write = async (name, data) => {
    await gate;
    await write(name, data);
  };
  const committing = f.manager.commit(progress);
  let flushed = false;
  const flushing = f.manager.flush().then(() => {
    flushed = true;
  });
  try {
    await committing;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(flushed).toBe(false);
    release();
    await flushing;
    expect(f.manager.view.status).toBe("Synced");
    expect([...f.files.values()].map((raw) => JSON.parse(raw).payload)).toContain(progress);
  } finally {
    release();
    await flushing;
    await f.manager.dispose();
  }
});

it("bounds disposal when an admitted metadata write never finishes", async () => {
  vi.useFakeTimers();
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    await f.manager.start(null);
    f.port.writeLocal = vi.fn(async () => gate);
    const committing = f.manager.commit(progress);
    await vi.waitFor(() => expect(f.port.writeLocal).toHaveBeenCalledOnce());
    let disposed = false;
    const closing = f.manager.dispose().then(() => (disposed = true));
    await vi.advanceTimersByTimeAsync(2000);
    expect(disposed).toBe(true);
    await closing;
    release();
    await committing;
    expect(f.files.size).toBe(0);
  } finally {
    release();
    await f.manager.dispose();
    vi.useRealTimers();
  }
});

it("revokes retained retry and start capabilities after disposal", async () => {
  const f = fixture();
  await f.manager.start(initial);
  await f.manager.flush();
  await f.manager.dispose();
  const list = (f.port.list = vi.fn(f.port.list));
  const identify = (f.port.identity = vi.fn(f.port.identity));
  await f.manager.retry();
  await f.manager.start(progress);
  expect(list).not.toHaveBeenCalled();
  expect(identify).not.toHaveBeenCalled();
});

it("retries again after a stalled background read and ignores its late result", async () => {
  vi.useFakeTimers();
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    f.port.list = async () => {
      throw new Error("offline");
    };
    await f.manager.start(initial);
    const remote = await snapshot(progress, other, 1);
    f.files.set(cloudName(remote), JSON.stringify(remote));
    const list = (f.port.list = vi.fn(async () => {
      if (list.mock.calls.length === 1) await gate;
      return [...f.files.keys()];
    }));
    await vi.advanceTimersByTimeAsync(15000);
    expect(list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20000);
    await vi.waitFor(() => expect(f.manager.view.status).toBe("Synced"));
    const saved = f.local.data;
    expect(list).toHaveBeenCalledTimes(2);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.local.data).toBe(saved);
    expect(f.install).not.toHaveBeenCalled();
  } finally {
    release();
    await f.manager.dispose();
    vi.useRealTimers();
  }
});

it("retains causal ancestry across overlapping local commits", async () => {
  const f = fixture();
  await f.manager.start(initial);
  await f.manager.flush();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const records: string[] = [];
  const write = f.port.writeLocal;
  f.port.writeLocal = async (data) => {
    records.push(data);
    if (records.length === 1) await gate;
    await write(data);
  };
  try {
    const first = f.manager.commit(progress);
    await vi.waitFor(() => expect(records).toHaveLength(1));
    const latest = encodeSave({ ...decodeSave(progress), currency: 17 });
    const second = f.manager.commit(latest);
    release();
    await Promise.all([first, second]);
    const earlier = await parseSnapshot(records[0]!, identity.profile);
    const later = await parseSnapshot(f.local.data!, identity.profile);
    expect(later.payload).toBe(latest);
    expect(later.ancestors).toContain(earlier.id);
    expect(newestHeads([earlier, later])).toEqual([later]);
  } finally {
    release();
    await f.manager.flush();
    await f.manager.dispose();
  }
});

it("recovers a valid remote backup when another slot rejects its read", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  const unreadable = cloudName({ device: other.device, sequence: 2 });
  f.files.set(unreadable, "unreadable");
  f.files.set(cloudName(remote), JSON.stringify(remote));
  const read = f.port.read;
  f.port.read = async (name) => {
    if (name === unreadable) throw new Error("slot unavailable");
    return read(name);
  };
  try {
    await f.manager.start(null);
    expect(f.install).toHaveBeenCalledWith(progress, expect.any(Function));
    expect(f.manager.view.status).toBe("Pending");
    expect(f.files.size).toBe(2);
    expect(f.files.get(unreadable)).toBe("unreadable");
  } finally {
    await f.manager.dispose();
  }
});

it("preserves divergent snapshots in both slots of the same device", async () => {
  const f = fixture();
  const first = await snapshot(initial, other, 1);
  const second = await snapshot(progress, other, 2);
  f.files.set(cloudName(first), JSON.stringify(first));
  f.files.set(cloudName(second), JSON.stringify(second));
  try {
    await f.manager.start(null);
    await f.manager.flush();
    const preserved = f.preserve.mock.calls.flatMap(([records]) => records.map((raw) => JSON.parse(raw).id));
    expect(preserved).toEqual(expect.arrayContaining([first.id, second.id]));
    const resolved = await parseSnapshot(f.local.data!, identity.profile);
    expect(resolved.ancestors).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(f.install).toHaveBeenCalledWith(
      [first, second].sort((a, b) => a.id.localeCompare(b.id))[0]!.payload,
      expect.any(Function),
    );
  } finally {
    await f.manager.dispose();
  }
});

it("pins account identity even if the transport mutates its returned object", async () => {
  const f = fixture();
  const transportIdentity = { ...identity };
  f.port.identity = async () => transportIdentity;
  try {
    await f.manager.start(initial);
    await f.manager.flush();
    transportIdentity.device = other.device;
    transportIdentity.profile = "d".repeat(32);
    await f.manager.commit(progress);
    await f.manager.flush();
    const saved = await parseSnapshot(f.local.data!, identity.profile);
    expect(saved.device).toBe(identity.device);
    expect(saved.profile).toBe(identity.profile);
    expect([...f.files.keys()].every((name) => name.includes(identity.device))).toBe(true);
  } finally {
    await f.manager.dispose();
  }
});

it("rejects more than 32 remote streams even when this device already has a slot", async () => {
  const f = fixture();
  const records = await Promise.all(
    [identity.device, ...Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(32, "0"))].map(
      (device) => snapshot(initial, { ...identity, device }, 1),
    ),
  );
  for (const record of records) f.files.set(cloudName(record), JSON.stringify(record));
  const before = new Map(f.files);
  try {
    await f.manager.start(initial);
    await f.manager.flush();
    expect(f.manager.view.status).toBe("Pending");
    expect(f.manager.view.error).toContain("device limit");
    expect(f.files).toEqual(before);
    expect(f.install).not.toHaveBeenCalled();
  } finally {
    await f.manager.dispose();
  }
});

it.each(["write", "read"] as const)(
  "does not start further transport calls after disposal during upload %s",
  async (stage) => {
    const f = fixture();
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const read = f.port.read;
    const write = f.port.write;
    f.port.write = vi.fn(async (name, data) => {
      if (stage === "write") {
        entered();
        await gate;
      }
      await write(name, data);
    });
    f.port.read = vi.fn(async (name) => {
      if (stage === "read") {
        entered();
        await gate;
      }
      return read(name);
    });
    f.port.acknowledge = vi.fn(async () => {});
    try {
      await f.manager.start(initial);
      await started;
      await f.manager.dispose();
      release();
      await f.manager.flush();
      expect(f.port.read).toHaveBeenCalledTimes(stage === "read" ? 1 : 0);
      expect(f.port.acknowledge).not.toHaveBeenCalled();
    } finally {
      release();
      await f.manager.dispose();
    }
  },
);

it.each(["write", "read", "acknowledge"] as const)(
  "revokes an upload paused at %s after offline takeover and safely retries it",
  async (stage) => {
    const f = fixture();
    await f.manager.start(null);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    const pause = async () => {
      entered();
      await gate;
    };
    const write = f.port.write;
    const read = f.port.read;
    f.port.write = vi.fn(async (name, data) => {
      if (stage === "write") await pause();
      await write(name, data);
    });
    f.port.read = vi.fn(async (name) => {
      if (stage === "read") await pause();
      return read(name);
    });
    f.port.acknowledge = vi.fn(async () => {
      if (stage === "acknowledge") await pause();
    });
    try {
      await f.manager.commit(progress);
      await started;
      expect(f.manager.offline()).toBe(true);
      release();
      await f.manager.flush();
      expect(f.port.read).toHaveBeenCalledTimes(stage === "write" ? 0 : 1);
      expect(f.port.acknowledge).toHaveBeenCalledTimes(stage === "acknowledge" ? 1 : 0);
      expect(f.manager.view.status).toBe("Pending");
      await f.manager.retry();
      await f.manager.flush();
      expect(f.manager.view.status).toBe("Synced");
      expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
    } finally {
      release();
      await f.manager.dispose();
    }
  },
);

it("durably restores metadata when recovering this device's remote checkpoint", async () => {
  const f = fixture();
  const remote = await snapshot(progress, identity, 8);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  try {
    await f.manager.start(null);
    await f.manager.flush();
    expect(f.install).toHaveBeenCalledWith(progress, expect.any(Function));
    expect(f.local.data).not.toBeNull();
    const restored = await parseSnapshot(f.local.data!, identity.profile);
    expect(restored.payload).toBe(progress);
    expect(restored.id === remote.id || restored.ancestors.includes(remote.id)).toBe(true);
  } finally {
    await f.manager.dispose();
  }
});

it("flush drains progress admitted by an upload-completion subscriber", async () => {
  const f = fixture();
  let manager: ReturnType<typeof createCloud>;
  let committed: Promise<void> | undefined;
  manager = createCloud(
    f.port,
    (view) => {
      if (view.status === "Synced" && !committed) committed = manager.commit(progress);
    },
    f.install,
  );
  try {
    await manager.start(initial);
    await manager.flush();
    expect(committed).toBeDefined();
    expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
    expect(manager.view.status).toBe("Synced");
    expect([...f.files.values()].some((raw) => JSON.parse(raw).payload === progress)).toBe(true);
  } finally {
    await committed;
    await manager.dispose();
    await f.manager.dispose();
  }
});
