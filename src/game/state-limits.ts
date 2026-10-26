/** Command admission and save decoding share the last supported revision */
export const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;

/** Automatic skipping must stop before advancing beyond the resumable turn range */
export const MAX_BATTLE_TURN = 1_000_000;

/** The saved per-actor allowance must support every authored borrowing tier */
export const MAX_FALLEN_CARDS_PER_TURN = 6;
