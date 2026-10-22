import type { SpeciesId } from "../../game/content";
import type { Session } from "../../application/session";
/** Loading a completed checkpoint is not a newly committed unlock. */
export function observeUnlocks(session: Session, reveal: (ids: SpeciesId[]) => void) {
  let previous = session.store.getState().game.unlocked;
  return session.store.subscribe((view) => {
    const added = view.committedCommand ? view.game.unlocked.filter((id) => !previous.includes(id)) : [];
    previous = view.game.unlocked;
    const fresh = added.filter((id) => view.game.journey?.unlocks.includes(id));
    if (fresh.length) reveal(fresh);
  });
}
