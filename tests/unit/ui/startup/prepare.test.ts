// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSession } from "../../../../src/application/session";
import { createStartupSplash } from "../../../../src/ui/startup/splash";
import { prepareStartup } from "../../../../src/ui/startup/prepare";
import { waitForFonts } from "../../../../src/ui/startup/images";
import { startupBaseArtwork } from "../../../../src/ui/startup/artwork";
const cache = vi.hoisted(() => ({
  prepare: vi.fn(),
  retain: vi.fn(),
  prefetch: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("../../../../src/ui/shared/artwork-cache", () => ({ createArtworkCache: () => cache }));
vi.mock("../../../../src/ui/startup/images", () => ({ waitForFonts: vi.fn() }));
let session: ReturnType<typeof createSession>;
let splash: ReturnType<typeof createStartupSplash>;
let startup: ReturnType<typeof prepareStartup>;
function deferred() {
  let resolve = () => {};
  return {
    promise: new Promise<void>((done) => {
      resolve = done;
    }),
    resolve: () => resolve(),
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(0);
  cache.prepare.mockReset().mockResolvedValue(undefined);
  cache.retain.mockReset().mockReturnValue(vi.fn());
  cache.prefetch.mockReset().mockImplementation(() => vi.fn());
  cache.dispose.mockReset();
  vi.mocked(waitForFonts).mockReset().mockResolvedValue(undefined);
  splash = createStartupSplash();
});
afterEach(async () => {
  startup?.dispose();
  splash.dispose();
  await session?.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("waits for session, essentials, fonts and minimum while deferred artwork never gates reveal", async () => {
  const saved = deferred(),
    essentials = deferred(),
    fonts = deferred(),
    deferredArt = deferred();
  const read = vi.fn(async () => {
    await saved.promise;
    return [];
  });
  session = createSession({ desktop: false, saves: { readCandidates: read, write: async () => {} } }, 7);
  vi.mocked(waitForFonts).mockReturnValue(fonts.promise);
  cache.prepare.mockImplementation(async (urls) => {
    if (urls !== startupBaseArtwork) await essentials.promise;
  });
  cache.prefetch.mockImplementation(() => {
    void deferredArt.promise;
    return vi.fn();
  });
  startup = prepareStartup(session, splash, vi.fn());
  let ready = false;
  void startup.ready.then(() => {
    ready = true;
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(ready).toBe(false);
  saved.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(ready).toBe(false);
  essentials.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(ready).toBe(false);
  fonts.resolve();
  await startup.ready;
  expect(ready).toBe(true);
  expect(read).toHaveBeenCalledOnce();
  expect(cache.prepare).toHaveBeenCalledTimes(2);
  expect(cache.prefetch).toHaveBeenCalledOnce();
  // Multiple presentation subscribers observe one preparation lifetime.
  await startup.ready;
  expect(read).toHaveBeenCalledOnce();
  deferredArt.resolve();
});
it("rejects invalid content once without waiting for the splash minimum or accessing saves", async () => {
  const read = vi.fn(async () => []);
  const write = vi.fn(async () => {});
  session = createSession(
    {
      desktop: false,
      saves: { readCandidates: read, write },
    },
    7,
  );
  const error = new Error("content");
  const validate = vi.fn(() => {
    throw error;
  });
  startup = prepareStartup(session, splash, validate);
  await expect(startup.ready).rejects.toBe(error);
  startup.dispose();
  await vi.advanceTimersByTimeAsync(20000);
  expect(validate).toHaveBeenCalledOnce();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(session.store.getState().ready).toBe(false);
  expect(session.diagnostics.snapshot()).toEqual([{ source: "validation", message: "content", count: 1 }]);
  expect(cache.prepare).toHaveBeenCalledOnce();
  expect(cache.dispose).toHaveBeenCalledOnce();
});
it("cancels preparation during loading without warming or revealing a late saved screen", async () => {
  const saved = deferred();
  session = createSession(
    {
      desktop: false,
      saves: {
        readCandidates: async () => {
          await saved.promise;
          return [];
        },
        write: async () => {},
      },
    },
    7,
  );
  const validate = vi.fn();
  startup = prepareStartup(session, splash, validate);
  await vi.advanceTimersByTimeAsync(0);
  startup.dispose();
  splash.dispose();
  await session.dispose();
  saved.resolve();
  await startup.ready;
  expect(validate).toHaveBeenCalledOnce();
  expect(cache.prepare).toHaveBeenCalledOnce();
  expect(session.store.getState().ready).toBe(false);
});
it("hands failed artwork to render recovery after loading the session", async () => {
  session = createSession(
    {
      desktop: false,
      saves: { readCandidates: async () => [], write: async () => {} },
    },
    7,
  );
  cache.prepare.mockImplementation(async (urls) => {
    if (urls !== startupBaseArtwork) throw new Error("preparation");
  });
  startup = prepareStartup(session, splash, vi.fn());
  await vi.advanceTimersByTimeAsync(5000);
  await startup.ready;
  expect(session.store.getState().ready).toBe(true);
  expect(cache.dispose).not.toHaveBeenCalled();
  expect(session.diagnostics.snapshot()).toEqual([{ source: "startup", message: "preparation", count: 1 }]);
});

it("releases obsolete optional warmup while hidden and on disposal", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  session = createSession(
    {
      desktop: false,
      saves: { readCandidates: async () => [], write: async () => {} },
    },
    7,
  );
  startup = prepareStartup(session, splash, vi.fn());
  await vi.advanceTimersByTimeAsync(5000);
  await startup.ready;
  expect(cache.prefetch).toHaveBeenCalledOnce();
  const first = cache.prefetch.mock.results[0]!.value;
  hidden.mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(first).toHaveBeenCalledOnce();
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  const last = cache.prefetch.mock.results.at(-1)!.value;
  expect(last).not.toHaveBeenCalled();
  startup.dispose();
  expect(last).toHaveBeenCalledOnce();
  const count = cache.prefetch.mock.calls.length;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(cache.prefetch).toHaveBeenCalledTimes(count);
});
