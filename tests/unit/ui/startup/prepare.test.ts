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
it("retries invalid content at its existing cadence before loading, and cancellation clears the retry", async () => {
  session = createSession(
    {
      desktop: false,
      steam: { available: false },
      saves: { readCandidates: async () => [], write: async () => {} },
    },
    7,
  );
  const validate = vi.fn().mockImplementationOnce(() => {
    throw new Error("content");
  });
  startup = prepareStartup(session, splash, validate);
  await vi.advanceTimersByTimeAsync(4999);
  expect(session.store.getState().ready).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await startup.ready;
  expect(validate).toHaveBeenCalledTimes(2);
  expect(session.store.getState().ready).toBe(true);
  expect(session.diagnostics.snapshot()[0]!.source).toBe("validation");
  startup.dispose();
  const broken = vi.fn(() => {
    throw new Error("content");
  });
  startup = prepareStartup(session, splash, broken);
  startup.dispose();
  await vi.advanceTimersByTimeAsync(15000);
  expect(broken).toHaveBeenCalledOnce();
  await startup.ready;
});
