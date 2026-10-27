import { expect, it } from "vitest";
import { createGame } from "../../../src/game/engine";
import { encodeSave } from "../../../src/game/save";
import { createRecordedSession } from "../../../src/tooling/recorded-session";

it.each(["saved", "state"] as const)("records and resumes %s checkpoints in journal order", async (mode) => {
  const initial = encodeSave(createGame(42));
  const journal: unknown[] = [];
  const recording = await createRecordedSession(initial, mode, async (entry) => {
    journal.push(entry);
  });
  try {
    const species = recording.session.store.getState().game.starterOffers[0]!;
    const command = { type: "draft", species } as const;
    const { step } = await recording.step(0, command, "Choose starter");
    expect(step.accepted).toBe(true);
    expect(journal).toEqual([
      { type: "attempt", index: 0, command, decision: "Choose starter" },
      { type: "completed", index: 0, ...step },
    ]);
    await recording.resume();
    expect(encodeSave(recording.session.store.getState().game)).toBe(step.checkpoint);
    const rejected = await recording.step(1, command, "Repeat starter");
    expect(rejected.step.accepted).toBe(false);
    expect(rejected.step.checkpoint).toBe(step.checkpoint);
    await expect(
      recording.step(2, command, "Replay", { ...rejected.step, checkpoint: "invalid" }),
    ).rejects.toThrow("Replay diverged at action 3");
    expect(journal.at(-1)).toMatchObject({ type: "completed", index: 2, accepted: false });
  } finally {
    await recording.dispose();
  }
});
