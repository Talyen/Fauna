import { it, expect } from "vitest";
import { balanceCase } from "../../src/application/balance";
import { performanceCases } from "../../src/application/performance";
import { decodeSave } from "../../src/game/save";
it("validates fixture grants, replays battle experiments and preserves non-loadout state", async () => {
  const checkpoint = performanceCases()[0]!.initial;
  const config = {
    checkpoint,
    seed: 42,
    starter: "mossback" as const,
    loadout: { talents: [], boons: ["bone-charm"] },
  };
  const result = await balanceCase(config, "test");
  expect(result.complete).toBe(true);
  expect(decodeSave(result.initial).boons).toEqual(["bone-charm"]);
  expect(decodeSave(result.initial).rng).toBe(decodeSave(checkpoint).rng);
  const replay = result.replay;
  const repeated = await balanceCase(config, "test", replay);
  expect(repeated.metrics).toEqual(result.metrics);
  const changed = structuredClone(replay);
  changed.steps[0]!.checkpoint = "corrupt";
  await expect(balanceCase(config, "test", changed)).rejects.toThrow("diverged");
  await expect(
    balanceCase({ ...config, loadout: { talents: ["physical.shield-slam"], boons: [] } }, "test"),
  ).rejects.toThrow();
});
