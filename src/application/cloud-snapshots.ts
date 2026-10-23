import { decodeSave, encodeSave } from "../game/save";
import type { CloudIdentity } from "../platform/ports";
export interface CloudSnapshot {
  version: 1;
  device: string;
  profile: string;
  sequence: number;
  payload: string;
  hash: string;
  ancestors: string[];
  id: string;
}
export const cloudIdentifier = /^[a-f0-9]{32}$/;
const digest = /^[a-f0-9]{64}$/;
export const cloudName = (s: Pick<CloudSnapshot, "device" | "sequence">) =>
  `fauna-v1-${s.device}-${s.sequence % 2}.json`;
export const isCloudName = (name: string) => /^fauna-v1-[a-f0-9]{32}-[01]\.json$/.test(name);
async function sha(text: string) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
const body = (s: Omit<CloudSnapshot, "id">) =>
  JSON.stringify([s.version, s.device, s.profile, s.sequence, s.hash, s.ancestors]);
export async function snapshot(
  payload: string,
  identity: CloudIdentity,
  sequence: number,
  parents: CloudSnapshot[] = [],
): Promise<CloudSnapshot> {
  payload = encodeSave(decodeSave(payload));
  const record: Omit<CloudSnapshot, "id"> = {
    version: 1,
    device: identity.device,
    profile: identity.profile,
    sequence,
    payload,
    hash: await sha(payload),
    // Retain every direct head before spending the bounded history on older ancestry.
    ancestors: [...new Set([...parents.map((p) => p.id), ...parents.flatMap((p) => p.ancestors)])].slice(
      0,
      64,
    ),
  };
  Object.freeze(record.ancestors);
  return Object.freeze({ ...record, id: await sha(body(record)) });
}
export async function parseSnapshot(raw: string, profile: string): Promise<CloudSnapshot> {
  if (new TextEncoder().encode(raw).length > 1_048_576)
    throw new Error("Cloud snapshot exceeds the size limit.");
  const s = JSON.parse(raw) as CloudSnapshot;
  if (
    s.version !== 1 ||
    typeof s.device !== "string" ||
    !cloudIdentifier.test(s.device) ||
    s.profile !== profile ||
    !Number.isSafeInteger(s.sequence) ||
    s.sequence < 1 ||
    !digest.test(s.hash) ||
    !digest.test(s.id) ||
    !Array.isArray(s.ancestors) ||
    s.ancestors.length > 64 ||
    new Set(s.ancestors).size !== s.ancestors.length ||
    s.ancestors.some((a) => typeof a !== "string" || !digest.test(a) || a === s.id) ||
    typeof s.payload !== "string"
  )
    throw new Error("Invalid cloud metadata.");
  const payload = encodeSave(decodeSave(s.payload));
  if (payload !== s.payload || (await sha(payload)) !== s.hash || (await sha(body(s))) !== s.id)
    throw new Error("Cloud snapshot failed validation.");
  Object.freeze(s.ancestors);
  return Object.freeze(s);
}
