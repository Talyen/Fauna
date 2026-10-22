import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const { replay, close, runtime } = vi.hoisted(() => {
  const replay = vi.fn();
  const close = vi.fn();
  return {
    replay,
    close,
    runtime: vi.fn(async () => ({
      ssrLoadModule: async () => ({ balanceCase: replay, runJourney: replay }),
      close,
    })),
  };
});
vi.mock("../../../scripts/lib/tool-runtime.mjs", async (original) => ({
  ...(await original()),
  identity: async () => "current-source",
  runtime,
}));
import { main } from "../../../scripts/balance/balance-compare.mjs";

afterEach(() => vi.clearAllMocks());

it.each([false, true])(
  "rejects an incomplete replay and closes its loader (checkpoint: %s)",
  async (checkpoint) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fauna-balance-replay-"));
    try {
      const input = path.join(root, "case.json");
      await writeFile(
        input,
        JSON.stringify({
          identity: "current-source",
          config: checkpoint ? { checkpoint: "saved-battle" } : {},
          replay: { config: {}, initial: "saved-game", steps: [] },
        }),
      );
      replay.mockResolvedValue({ complete: false, reason: "Action budget exhausted" });
      await expect(main(["replay", input])).rejects.toThrow(
        "Incomplete balance replay: Action budget exhausted",
      );
      expect(close).toHaveBeenCalledTimes(1);
      replay.mockResolvedValue({ complete: true });
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await main(["replay", input]);
        expect(log).toHaveBeenCalledWith("Balance replay matched all checkpoints.");
      } finally {
        log.mockRestore();
      }
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
