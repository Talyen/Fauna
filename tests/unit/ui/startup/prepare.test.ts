// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSession } from "../../../../src/application/session";
import { createStartupSplash } from "../../../../src/ui/startup/splash";
import { prepareStartup } from "../../../../src/ui/startup/prepare";
import { warmImages, waitForFonts } from "../../../../src/ui/startup/images";
import { startupBaseArtwork } from "../../../../src/ui/startup/artwork";
vi.mock("../../../../src/ui/startup/images", () => ({ warmImages: vi.fn(), waitForFonts: vi.fn() }));
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
  vi.mocked(warmImages).mockReset().mockResolvedValue(undefined);
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
  session = createSession(
    { desktop: false, steam: { available: false }, saves: { readCandidates: read, write: async () => {} } },
    7,
  );
  vi.mocked(waitForFonts).mockReturnValue(fonts.promise);
  vi.mocked(warmImages).mockImplementation(async (_urls, _signal, _report, retained) => {
    if (!retained) await deferredArt.promise;
    else if (_urls !== startupBaseArtwork) await essentials.promise;
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
  expect(warmImages).toHaveBeenCalledTimes(3);
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
      steam: { available: false },
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
  expect(warmImages).toHaveBeenCalledOnce();
  expect(vi.mocked(warmImages).mock.calls[0]![1].aborted).toBe(true);
});
it("cancels preparation during loading without warming or revealing a late saved screen", async () => {
  const saved = deferred();
  session = createSession(
    {
      desktop: false,
      steam: { available: false },
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
  expect(warmImages).toHaveBeenCalledOnce();
  expect(session.store.getState().ready).toBe(false);
});
it("diagnoses an unexpected preparation failure without calling it invalid content", async () => {
  session = createSession(
    {
      desktop: false,
      steam: { available: false },
      saves: { readCandidates: async () => [], write: async () => {} },
    },
    7,
  );
  vi.mocked(warmImages).mockImplementation(async (urls) => {
    if (urls !== startupBaseArtwork) throw new Error("preparation");
  });
  startup = prepareStartup(session, splash, vi.fn());
  await expect(startup.ready).rejects.toThrow("preparation");
  expect(session.diagnostics.snapshot()).toEqual([{ source: "startup", message: "preparation", count: 1 }]);
});

it("bounds optional warmup and cancels its work while hidden and on disposal", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  session = createSession(
    {
      desktop: false,
      steam: { available: false },
      saves: { readCandidates: async () => [], write: async () => {} },
    },
    7,
  );
  startup = prepareStartup(session, splash, vi.fn());
  await vi.advanceTimersByTimeAsync(5000);
  await startup.ready;
  const optional = vi.mocked(warmImages).mock.calls.filter((call) => !call[3]);
  expect(optional).toHaveLength(1);
  expect(optional[0]![0].length).toBeLessThanOrEqual(8);
  const first = optional[0]![1];
  hidden.mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(first.aborted).toBe(true);
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  const last = vi.mocked(warmImages).mock.calls.at(-1)![1];
  expect(last.aborted).toBe(false);
  startup.dispose();
  expect(last.aborted).toBe(true);
  const count = vi.mocked(warmImages).mock.calls.length;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(warmImages).toHaveBeenCalledTimes(count);
});
