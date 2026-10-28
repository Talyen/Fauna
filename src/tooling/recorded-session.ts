import { createSession, type Session } from "../application/session";
import { decodeSave, encodeSave } from "../game/save";
import type { Command } from "../game/types";
export interface JourneyStep {
  command: Command;
  accepted: boolean;
  checkpoint: string;
  decision: string;
}

/** Own the save, journal and replay ordering shared by both headless runners. */
export async function createRecordedSession(
  initial: string,
  checkpoint: "saved" | "state",
  journal?: (record: unknown) => Promise<void>,
) {
  let saved = initial;
  async function open() {
    const session = createSession({
      desktop: false,
      saves: {
        readCandidates: async () => [{ source: "primary", data: saved }],
        write: async (data) => {
          saved = data;
        },
      },
    });
    await session.load();
    return session;
  }
  let session: Session = await open();
  return {
    get session() {
      return session;
    },
    async step(index: number, command: Command, decision: string, expected?: JourneyStep) {
      await journal?.({ type: "attempt", index, command, decision });
      const accepted = session.command(command);
      if (!(await session.flush())) throw new Error("In-memory save failed.");
      const after = session.store.getState().game;
      const step: JourneyStep = {
        command,
        accepted,
        checkpoint: encodeSave(decodeSave(checkpoint === "saved" ? saved : encodeSave(after))),
        decision,
      };
      await journal?.({ type: "completed", index, ...step });
      if (expected && (step.checkpoint !== expected.checkpoint || accepted !== expected.accepted))
        throw new Error(`Replay diverged at action ${index + 1}.`);
      return { after, step };
    },
    async resume() {
      await session.dispose();
      session = await open();
    },
    dispose() {
      return session.dispose();
    },
  };
}
