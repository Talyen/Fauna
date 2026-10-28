import { deferred } from "../../support/deferred";
import { cloudFixture as fixture, cloudIdentity as identity } from "../../support/cloud";
import { expect, it, vi } from "vitest";
import { cloudName, parseSnapshot, snapshot } from "../../../src/application/cloud-snapshots";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { createGame } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";

const payload = encodeSave(decodeSave(encodeSave(createGame(3))));

it.each(["identity", "list", "install"] as const)(
  "automatically recovers remote progress after startup fails at %s with no local save",
  async (stage) => {
    vi.useFakeTimers();
    const f = fixture();
    try {
      const remote = await snapshot(payload, { ...identity, device: "c".repeat(32) }, 1);
      f.files.set(cloudName(remote), JSON.stringify(remote));
      if (stage === "identity")
        f.port.identity = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(identity);
      else if (stage === "list")
        f.port.list = vi
          .fn()
          .mockRejectedValueOnce(new Error("offline"))
          .mockResolvedValue([...f.files.keys()]);
      else f.install.mockRejectedValueOnce(new Error("disk busy"));
      await f.manager.start(null);
      expect(f.manager.view.status).toBe("Pending");
      f.install.mockClear();
      await vi.advanceTimersByTimeAsync(15000);
      await vi.waitFor(() => expect(f.install).toHaveBeenCalledWith(payload, expect.any(Function)));
      await f.manager.flush();
      expect(f.manager.view.status).toBe("Synced");
    } finally {
      await f.manager.dispose();
      vi.useRealTimers();
    }
  },
);

it("shares concurrent retries so they cannot cancel each other's recovery lease", async () => {
  const f = fixture();
  const { promise: gate, resolve: release } = deferred();
  const { promise: reading, resolve: entered } = deferred();
  try {
    await f.manager.start(null);
    const remote = await snapshot(payload, { ...identity, device: "c".repeat(32) }, 1);
    f.files.set(cloudName(remote), JSON.stringify(remote));
    f.port.list = vi.fn(async () => {
      entered();
      await gate;
      return [...f.files.keys()];
    });
    const first = f.manager.retry();
    await reading;
    const second = f.manager.retry();
    release();
    await Promise.all([first, second]);
    await f.manager.flush();
    expect(f.port.list).toHaveBeenCalledOnce();
    expect(f.install).toHaveBeenCalledExactlyOnceWith(payload, expect.any(Function));
    expect(f.manager.view.status).toBe("Synced");
  } finally {
    release();
    await f.manager.dispose();
  }
});

it("keeps saving and uploading when a Cloud status observer throws", async () => {
  const f = fixture({
    publish: () => {
      throw new Error("observer failed");
    },
  });
  await f.manager.start(payload);
  await f.manager.flush();
  expect(f.manager.view.status).toBe("Synced");
  const saved = await parseSnapshot(f.local.data!, identity.profile);
  expect(saved.payload).toBe(payload);
  expect(f.files.get(cloudName(saved))).toBe(JSON.stringify(saved));
});

it("captures parent identities and ancestry before snapshot hashing yields", async () => {
  const original = await snapshot(payload, identity, 1);
  const parent = structuredClone(original);
  const ancestors = [...parent.ancestors];
  const child = snapshot(payload, identity, 2, [parent]);
  Object.assign(parent, { id: "d".repeat(64) });
  // A caller can own mutable data even when the API accepts a readonly view
  ancestors.push("e".repeat(64));
  Object.assign(parent, { ancestors });
  const result = await child;
  expect(result.ancestors).toEqual([original.id]);
  expect(await parseSnapshot(JSON.stringify(result), identity.profile)).toEqual(result);
});

it.each(["José", "Jose\u0301", "玩家", "🌲"])(
  "redacts the complete diagnostic directory for Unicode username %s",
  (username) => {
    let stored = "";
    const diagnostics = createDiagnostics({
      read: () => null,
      write: (data) => {
        stored = data;
      },
    });
    diagnostics.record("save-write", `failed /Users/${username}/Library/Application Support/Fauna/save.json`);
    expect(diagnostics.snapshot()[0]!.message).toBe("failed [path]/save.json");
    expect(stored).not.toContain(username);
    diagnostics.dispose();
  },
);

it.each([
  "failed /Users/private-user",
  "failed \\\\server\\private-user\\save.json",
  "request failed with Bearer private-credential",
])("removes sensitive details from diagnostic messages: %s", (message) => {
  let stored = "";
  const diagnostics = createDiagnostics({
    read: () => null,
    write: (value) => (stored = value),
  });
  diagnostics.record("global", message);
  expect(diagnostics.snapshot()[0]!.message).not.toContain("private");
  expect(stored).not.toContain("private");
});

it("discards invalid persisted revision context just as it does live context", () => {
  const diagnostics = createDiagnostics({
    read: () =>
      JSON.stringify([{ source: "global", message: "failure", count: 1, revision: -1, phase: "battle" }]),
    write: () => {},
  });
  expect(diagnostics.snapshot()).toEqual([{ source: "global", message: "failure", count: 1 }]);
});

it("keeps cloud recovery available when a transport error message throws", async () => {
  const f = fixture();
  const error = new Error();
  Object.defineProperty(error, "message", {
    get: () => {
      throw new Error("unreadable message");
    },
  });
  f.port.identity = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(identity);
  await f.manager.start(payload);
  expect(f.manager.view).toMatchObject({ status: "Pending", blocking: false, error: "Cloud sync failed." });
  await f.manager.retry();
  await f.manager.flush();
  expect(f.manager.view.status).toBe("Synced");
});
