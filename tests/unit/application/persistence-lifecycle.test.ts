import { deferred } from "../../support/deferred";
import { cloudFixture as fixture, cloudIdentity as identity } from "../../support/cloud";
import { expect, it, vi } from "vitest";
import { cloudName, parseSnapshot, snapshot } from "../../../src/application/cloud-snapshots";
import { createSession } from "../../../src/application/session";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { run } from "../../support/game";

const rawInitial = encodeSave(run());
const initial = encodeSave(decodeSave(rawInitial));
const progress = encodeSave({ ...decodeSave(initial), currency: 20 });

it.each(["startup", "commit"] as const)(
  "keeps disabled Cloud unavailable after %s metadata failure",
  async (stage) => {
    const f = fixture({ identity: { ...identity, enabled: false } });
    const writeLocal = f.port.writeLocal;
    const fail = async () => {
      throw new Error("metadata unavailable");
    };
    if (stage === "startup") f.port.writeLocal = fail;
    await f.manager.start(initial);
    if (stage === "commit") f.port.writeLocal = fail;
    await f.manager.commit(progress);
    await f.manager.flush();
    expect(f.port.write).not.toHaveBeenCalled();
    expect(f.manager.view.status).toBe("Unavailable");
    f.port.writeLocal = writeLocal;
    await f.manager.commit(progress);
    await f.manager.flush();
    expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
    expect(f.manager.view).toEqual({ status: "Unavailable", blocking: false, error: "" });
    expect(f.port.write).not.toHaveBeenCalled();
  },
);

it("retains the active local journey when an explicit retry finds a remote descendant", async () => {
  const f = fixture();
  await f.manager.start(initial);
  await f.manager.flush();
  const parent = await parseSnapshot(f.local.data!, identity.profile);
  const remote = await snapshot(progress, { ...identity, device: "c".repeat(32) }, 1, [parent]);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.retry();
  await f.manager.flush();
  expect(f.install).not.toHaveBeenCalled();
  const saved = await parseSnapshot(f.local.data!, identity.profile);
  expect(saved.payload).toBe(initial);
  expect(saved.ancestors).toContain(remote.id);
});

it("still recovers missing local progress when a failed startup installation is retried", async () => {
  const f = fixture();
  const remote = await snapshot(progress, { ...identity, device: "c".repeat(32) }, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  f.install.mockRejectedValueOnce(new Error("disk unavailable"));
  await f.manager.start(null);
  expect(f.manager.view.status).toBe("Pending");
  await f.manager.retry();
  await f.manager.flush();
  expect(f.install).toHaveBeenLastCalledWith(progress, expect.any(Function));
  expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
  expect(f.manager.view.status).toBe("Synced");
});

it.each(["startup", "retry"] as const)(
  "does not let an expired older %s take a newer successful sync offline",
  async (stage) => {
    vi.useFakeTimers();
    const f = fixture();
    let release!: () => void;
    let first: Promise<void> | undefined;
    try {
      if (stage === "retry") {
        await f.manager.start(initial);
        await f.manager.flush();
      }
      const gate = new Promise<void>((resolve) => (release = resolve));
      const { promise: started, resolve: entered } = deferred();
      f.port.list = vi
        .fn()
        .mockImplementationOnce(async () => {
          entered();
          await gate;
          return [...f.files.keys()];
        })
        .mockImplementation(async () => [...f.files.keys()]);
      first = stage === "startup" ? f.manager.start(initial) : f.manager.retry();
      await started;
      if (stage === "retry") {
        const coalesced = f.manager.retry();
        expect(coalesced).toBe(first);
        await vi.advanceTimersByTimeAsync(5000);
        await first;
      }
      await f.manager.retry();
      await f.manager.flush();
      expect(f.manager.view.status).toBe("Synced");
      await vi.advanceTimersByTimeAsync(5000);
      await first;
      expect(f.manager.view.status).toBe("Synced");
    } finally {
      release?.();
      await first;
      await f.manager.dispose();
      vi.useRealTimers();
    }
  },
);

it("still restores a missing remote checkpoint during reconciliation", async () => {
  const f = fixture();
  await f.manager.start(initial);
  await f.manager.flush();
  f.files.clear();
  await f.manager.retry();
  await f.manager.flush();
  expect(f.files.size).toBeGreaterThan(0);
  expect(f.manager.view.status).toBe("Synced");
});

it("still releases startup when its own remote read exceeds the deadline", async () => {
  vi.useFakeTimers();
  const f = fixture();
  let release!: () => void;
  try {
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { promise: started, resolve: entered } = deferred();
    f.port.list = async () => {
      entered();
      await gate;
      return [];
    };
    const loading = f.manager.start(initial);
    await started;
    expect(f.manager.view.blocking).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    await loading;
    expect(f.manager.view.blocking).toBe(false);
    expect(f.manager.view.status).toBe("Pending");
    release();
    await f.manager.flush();
    expect(f.port.write).not.toHaveBeenCalled();
  } finally {
    release?.();
    await f.manager.dispose();
    vi.useRealTimers();
  }
});

it("does not start Cloud after a loaded-save subscriber begins closing", async () => {
  const f = fixture();
  const identify = (f.port.identity = vi.fn(f.port.identity));
  const session = createSession({
    desktop: true,
    steam: { available: false },
    cloud: f.port,
    quit: async () => {},
    saves: {
      readCandidates: async () => [{ source: "primary", data: progress }],
      write: async () => {},
    },
  });
  let closing: Promise<void> | undefined;
  session.store.subscribe((view) => {
    if (view.game.currency === 20 && !view.closing) closing = session.quit();
  });
  try {
    await session.load();
    await closing;
    expect(session.store.getState().closing).toBe(true);
    expect(identify).not.toHaveBeenCalled();
    expect(f.port.write).not.toHaveBeenCalled();
  } finally {
    await session.dispose();
    await f.manager.dispose();
  }
});

it("does not upload an unchanged checkpoint that Cloud already acknowledged", async () => {
  const f = fixture();
  await f.manager.start(initial);
  await f.manager.flush();
  const uploads = vi.mocked(f.port.write).mock.calls.length;
  expect(uploads).toBeGreaterThan(0);
  await f.manager.commit(rawInitial);
  await f.manager.flush();
  expect(f.port.write).toHaveBeenCalledTimes(uploads);
  expect(f.manager.view.status).toBe("Synced");
});
