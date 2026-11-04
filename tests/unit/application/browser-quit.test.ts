import { expect, it, vi } from "vitest";
import { createSession } from "../../../src/application/session";
import { deferred } from "../../support/deferred";

it("waits for browser saves before attempting to close and stays playable if the tab remains open", async () => {
  const write = deferred();
  const closeTab = vi.fn();
  const session = createSession(
    {
      desktop: false,
      closeTab,
      saves: { readCandidates: async () => [], write: () => write.promise },
    },
    3,
  );
  await session.load();
  expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
    true,
  );
  const quit = session.quit();
  expect(closeTab).not.toHaveBeenCalled();
  write.resolve();
  await quit;
  expect(closeTab).toHaveBeenCalledOnce();
  expect(session.store.getState().closing).toBe(false);
  expect(session.command({ type: "start" })).toBe(true);
  await session.dispose();
});

it("does not attempt to close when a browser save fails", async () => {
  const closeTab = vi.fn();
  const session = createSession(
    {
      desktop: false,
      closeTab,
      saves: {
        readCandidates: async () => [],
        write: async () => {
          throw new Error("storage unavailable");
        },
      },
    },
    3,
  );
  await session.load();
  expect(session.command({ type: "draft", species: session.store.getState().game.starterOffers[0]! })).toBe(
    true,
  );
  await session.quit();
  expect(closeTab).not.toHaveBeenCalled();
  expect(session.store.getState().saveStatus).toBe("error");
  await session.dispose();
});
