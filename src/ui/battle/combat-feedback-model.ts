import type { GameEvent, DamageEvent, StatusEvent } from "../../game/types";

/** Display aggregation can combine facts without pretending to be another committed event. */
export interface FeedbackEntry {
  id: string;
  kind: "damage" | "heal" | "block" | "knockout" | "status";
  text: string;
  targetId: string;
  actorId?: string;
  amount?: number;
  damageType?: DamageEvent["damageType"];
  critical?: boolean;
  periodic?: boolean;
  impact?: boolean;
  additive?: boolean;
  status?: StatusEvent["status"];
  outcome?: StatusEvent["outcome"];
  affectedStatus?: StatusEvent["affectedStatus"];
  reservedDigits?: number;
}
function feedbackEntry(event: GameEvent, id: string): FeedbackEntry | null {
  switch (event.kind) {
    case "damage":
    case "heal":
    case "block":
      return { ...event, id };
    case "status":
      return event.targetId ? { ...event, targetId: event.targetId, id } : null;
    case "knockout":
      return event.targetId ? { ...event, targetId: event.targetId, id } : null;
    default:
      return null;
  }
}
export interface Burst {
  id: string;
  targetId: string;
  started: number;
  lifetime: number;
  entries: FeedbackEntry[];
}
// Stylesheet-free callers use the ordinary readable lifetime. Runtime reads tokens.css.
const DEFAULT_LIFETIME = 1100;
export const isFeedbackNotice = (e: Pick<FeedbackEntry, "kind" | "outcome" | "amount">) =>
  e.kind === "knockout" || (e.kind === "status" && !(e.outcome === "gain" && e.amount !== undefined));
const priority = (e: Pick<FeedbackEntry, "kind" | "outcome" | "amount">) =>
  isFeedbackNotice(e) ? 0 : e.kind === "damage" || (e.amount ?? 0) < 0 ? 1 : 2;
function matches(a: FeedbackEntry, b: FeedbackEntry) {
  return (
    a.kind === b.kind &&
    a.damageType === b.damageType &&
    a.status === b.status &&
    a.outcome === b.outcome &&
    a.affectedStatus === b.affectedStatus &&
    (isFeedbackNotice(a)
      ? a.status !== undefined || a.text === b.text
      : a.impact === b.impact && Math.sign(a.amount ?? 0) === Math.sign(b.amount ?? 0))
  );
}
function merge(a: FeedbackEntry, b: FeedbackEntry): FeedbackEntry {
  return isFeedbackNotice(a)
    ? a
    : {
        ...a,
        amount: (a.amount ?? 0) + (b.amount ?? 0),
        critical: a.critical || b.critical,
        periodic: a.periodic === true && b.periodic === true,
      };
}

/** Try the newest eligible burst first, without mutating the published bursts. */
function combineBursts(bursts: readonly Burst[], targetId: string, entries: FeedbackEntry[], now: number) {
  const next = [...bursts];
  const unmatched: FeedbackEntry[] = [];
  for (const entry of entries) {
    let found = false;
    for (let i = next.length - 1; i >= 0 && !found; i--) {
      const burst = next[i]!;
      if (burst.targetId !== targetId || now < burst.started || now - burst.started >= 250) continue;
      const index = burst.entries.findIndex(
        (e) =>
          matches(e, entry) &&
          (isFeedbackNotice(e) ||
            (e.additive !== false &&
              entry.additive !== false &&
              !!e.periodic === !!entry.periodic &&
              String(Math.abs((e.amount ?? 0) + (entry.amount ?? 0))).length <= (e.reservedDigits ?? 0))),
      );
      if (index < 0) continue;
      const updated = [...burst.entries];
      updated[index] = merge(updated[index]!, entry);
      next[i] = { ...burst, entries: updated };
      found = true;
    }
    if (!found) unmatched.push(entry);
  }
  return { next, unmatched };
}

/** Display totals never mutate committed events or drive audio/impact strength. */
export function appendFeedback(
  previous: readonly Burst[],
  events: readonly GameEvent[],
  id: number | string,
  now: number,
  lifetime = DEFAULT_LIFETIME,
): Burst[] {
  let bursts = previous.filter((b) => now < b.started + b.lifetime);
  const targets = new Map<string, FeedbackEntry[]>();
  for (const [index, event] of events.entries()) {
    const entry = feedbackEntry(event, `${id}:${index}`);
    if (!entry) continue;
    const entries = targets.get(entry.targetId) ?? [];
    const prior = entries.findIndex(
      (e) =>
        matches(e, entry) &&
        (isFeedbackNotice(e) ||
          (e.kind === "damage" && e.impact !== false) ||
          (e.additive !== false && entry.additive !== false)),
    );
    if (prior >= 0) entries[prior] = merge(entries[prior]!, entry);
    else entries.push(entry);
    targets.set(entry.targetId, entries);
  }
  const hasMeaningful = [...targets.values()].some((entries) => entries.some((e) => e.amount !== 0));
  let fallbackShown = false;
  for (const [targetId, raw] of targets) {
    const meaningful = raw.filter((e) => e.amount !== 0);
    if (!meaningful.length && (hasMeaningful || fallbackShown)) continue;
    if (!meaningful.length) fallbackShown = true;
    const entries = (meaningful.length ? meaningful : raw.slice(0, 1))
      .sort((a, b) => priority(a) - priority(b))
      .map((e) =>
        isFeedbackNotice(e) ? e : { ...e, reservedDigits: String(Math.abs(e.amount ?? 0)).length + 1 },
      );
    let result = combineBursts(bursts, targetId, entries, now);
    if (result.unmatched.length && bursts.filter((b) => b.targetId === targetId).length >= 3) {
      // Retry from untouched survivors so eviction cannot erase a newly merged result.
      const oldest = bursts.findIndex((b) => b.targetId === targetId);
      bursts = bursts.filter((_, i) => i !== oldest);
      result = combineBursts(bursts, targetId, entries, now);
    }
    bursts = result.next;
    if (result.unmatched.length)
      bursts.push({ id: `${id}-${targetId}`, targetId, started: now, lifetime, entries: result.unmatched });
  }
  return bursts;
}

/** Action boundaries, rather than proc source IDs, own presentation sequencing. */
export function feedbackFrames(events: readonly GameEvent[]): GameEvent[][] {
  const frames: GameEvent[][] = [];
  for (const event of events) {
    if (event.kind === "action" || !frames.length) frames.push([]);
    frames[frames.length - 1]!.push(event);
  }
  return frames.filter((frame) =>
    frame.some(
      (e) =>
        (e.kind === "action" && (e.actionType === "attack" || e.actionType === "support")) ||
        ("targetId" in e && e.targetId && ["damage", "heal", "block", "knockout", "status"].includes(e.kind)),
    ),
  );
}
