import { deferred } from "../../support/deferred";
import { expect, it, vi } from "vitest";
import { createSession as createSeededSession } from "../../../src/application/session";
import type { Platform } from "../../../src/platform/ports";
// Keep lifecycle fixtures independent of roster-driven changes to the default starter offers.
const createSession: typeof createSeededSession = (platform, seed = 3, capabilities) =>
  createSeededSession(platform, seed, capabilities);
it("overlay activation revokes commands immediately and disposed subscriptions cannot resume a session", async () => {
  let overlay: ((active: boolean) => void) | undefined;
  const writes: string[] = [];
  const platform: Platform = {
    desktop: true,
    steam: { available: false },
    saves: {
      readCandidates: async () => [],
      write: async (data) => {
        writes.push(data);
      },
    },
    onOverlay: (handler) => {
      overlay = handler;
      return () => {
        overlay = undefined;
      };
    },
  };
  const session = createSession(platform);
  await session.load();
  overlay!(true);
  expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
    false,
  );
  expect(writes).toEqual([]);
  overlay!(false);
  expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
    true,
  );
  const old = overlay!;
  await session.dispose();
  old(false);
  expect(session.store.getState().ready).toBe(false);
  expect(writes.length).toBe(1);
});
it("keeps local saving successful when cloud metadata cannot be written", async () => {
  let local = "";
  const session = createSession({
    desktop: true,
    steam: { available: false },
    saves: {
      readCandidates: async () => [],
      write: async (data) => {
        local = data;
      },
    },
    cloud: {
      identity: async () => ({
        available: true,
        device: "a".repeat(32),
        profile: "b".repeat(32),
        importAvailable: false,
      }),
      readLocal: async () => null,
      writeLocal: async () => {
        throw new Error("metadata failure");
      },
      preserve: async () => {},
      importStandalone: async () => [],
      list: async () => [],
      read: async () => null,
      write: async () => {
        throw new Error("must not upload");
      },
    },
  });
  await session.load();
  expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
    true,
  );
  expect(await session.flush()).toBe(true);
  expect(JSON.parse(local).selected).toEqual(session.store.getState().game.selected);
  await vi.waitFor(() => expect(session.store.getState().cloud.status).toBe("Pending"));
  expect(session.store.getState().saveStatus).toBe("saved");
  await session.dispose();
});
it("does not attempt cloud metadata or report pending sync when Steam is unavailable", async () => {
  let metadataWrites = 0;
  const session = createSession({
    desktop: true,
    steam: { available: false },
    saves: { readCandidates: async () => [], write: async () => {} },
    cloud: {
      identity: async () => ({ available: false, device: "", profile: "", importAvailable: false }),
      readLocal: async () => null,
      writeLocal: async () => {
        metadataWrites++;
        throw new Error("unavailable");
      },
      preserve: async () => {},
      importStandalone: async () => [],
      list: async () => [],
      read: async () => null,
      write: async () => {},
    },
  });
  await session.load();
  expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
    true,
  );
  await session.flush();
  expect(metadataWrites).toBe(0);
  expect(session.store.getState().cloud.status).toBe("Unavailable");
  await session.dispose();
});

it.each(["quit", "dispose"] as const)(
  "keeps newer local saves and bounded %s independent of stalled cloud metadata",
  async (close) => {
    vi.useFakeTimers();
    const { promise: gate, resolve: release } = deferred();
    const metadata = vi.fn(async () => {
      await gate;
    });
    const saved: number[] = [];
    const quit = vi.fn(async () => {});
    const session = createSession({
      desktop: true,
      steam: { available: false },
      quit,
      saves: {
        readCandidates: async () => [],
        write: async (data) => {
          saved.push(JSON.parse(data).revision);
        },
      },
      cloud: {
        identity: async () => ({
          available: true,
          device: "a".repeat(32),
          profile: "b".repeat(32),
          importAvailable: false,
        }),
        readLocal: async () => null,
        writeLocal: metadata,
        preserve: async () => {},
        importStandalone: async () => [],
        list: async () => [],
        read: async () => null,
        write: async () => {},
      },
    });
    try {
      await session.load();
      session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! });
      await vi.waitFor(() => expect(metadata).toHaveBeenCalledOnce());
      session.command({ type: "start" });
      let closed = false;
      const closing = session[close]().then(() => (closed = true));
      await vi.advanceTimersByTimeAsync(2100);
      expect(closed).toBe(true);
      expect(saved).toEqual([1, 2]);
      expect(quit).toHaveBeenCalledTimes(close === "quit" ? 1 : 0);
      release();
      await closing;
    } finally {
      release();
      await session.dispose();
      vi.useRealTimers();
    }
  },
);
