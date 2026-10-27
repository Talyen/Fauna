import { z } from "zod";
import { decodeSave, encodeSave } from "../game/save";
import type { CloudIdentity } from "../platform/ports";
export const cloudIdentifier = /^[a-f0-9]{32}$/;
const digest = /^[a-f0-9]{64}$/;
const MAX_ANCESTORS = 64;
const MAX_SNAPSHOT_BYTES = 1_048_576;
const snapshotSchema = z
  .object({
    version: z.literal(1),
    device: z.string().regex(cloudIdentifier),
    profile: z.string().regex(cloudIdentifier),
    sequence: z.number().int().min(1),
    payload: z.string(),
    hash: z.string().regex(digest),
    ancestors: z.array(z.string().regex(digest)).max(MAX_ANCESTORS).readonly(),
    id: z.string().regex(digest),
  })
  .readonly();
export type CloudSnapshot = z.infer<typeof snapshotSchema>;
export const cloudName = (s: Pick<CloudSnapshot, "device" | "sequence">) =>
  `fauna-v1-${s.device}-${s.sequence % 2}.json`;
const cloudNamePattern = /^fauna-v1-[a-f0-9]{32}-[01]\.json$/;
export const isCloudName = (name: string) => cloudNamePattern.test(name);
const textEncoder = new TextEncoder();
async function sha(text: string) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(text));
  const digits = "0123456789abcdef";
  let result = "";
  for (const byte of new Uint8Array(bytes)) result += digits[byte >>> 4]! + digits[byte & 15]!;
  return result;
}
const body = (s: Omit<CloudSnapshot, "id">) =>
  JSON.stringify([s.version, s.device, s.profile, s.sequence, s.hash, s.ancestors]);
export async function snapshot(
  payload: string,
  identity: CloudIdentity,
  sequence: number,
  parents: readonly CloudSnapshot[] = [],
): Promise<CloudSnapshot> {
  // Own parent facts before hashing yields; readonly inputs can alias caller-owned data.
  const ancestry = new Set<string>();
  let invalidProfile = false;
  const parentsAtAdmission = parents.map((parent) => {
    ancestry.add(parent.id);
    if (parent.profile !== identity.profile) invalidProfile = true;
    return [...parent.ancestors];
  });
  if (invalidProfile) throw new Error("Cloud ancestry belongs to another profile.");
  if (ancestry.size > MAX_ANCESTORS)
    throw new Error("Cloud ancestry limit reached; competing snapshots remain separate.");
  payload = encodeSave(decodeSave(payload));
  for (const parent of parentsAtAdmission) {
    for (const ancestor of parent) {
      if (ancestry.size >= MAX_ANCESTORS) break;
      ancestry.add(ancestor);
    }
    if (ancestry.size >= MAX_ANCESTORS) break;
  }
  const record: Omit<CloudSnapshot, "id"> = {
    version: 1,
    device: identity.device,
    profile: identity.profile,
    sequence,
    payload,
    hash: await sha(payload),
    // Retain every direct head before spending the bounded history on older ancestry.
    ancestors: [...ancestry],
  };
  Object.freeze(record.ancestors);
  return snapshotSchema.parse({ ...record, id: await sha(body(record)) });
}
export async function parseSnapshot(raw: string, profile: string): Promise<CloudSnapshot> {
  // Each UTF-16 code unit contributes at most three UTF-8 bytes.
  if (
    raw.length > MAX_SNAPSHOT_BYTES ||
    (raw.length > Math.floor(MAX_SNAPSHOT_BYTES / 3) && textEncoder.encode(raw).length > MAX_SNAPSHOT_BYTES)
  )
    throw new Error("Cloud snapshot exceeds the size limit.");
  const parsed = snapshotSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Invalid cloud metadata.");
  const s = parsed.data;
  if (s.profile !== profile) throw new Error("Invalid cloud metadata.");
  if (s.ancestors.length === 1) {
    if (s.ancestors[0] === s.id) throw new Error("Invalid cloud metadata.");
  } else if (s.ancestors.length === 2) {
    if (s.ancestors[0] === s.ancestors[1] || s.ancestors.includes(s.id))
      throw new Error("Invalid cloud metadata.");
  } else if (s.ancestors.length > 1) {
    const ancestors = new Set(s.ancestors);
    if (ancestors.size !== s.ancestors.length || ancestors.has(s.id))
      throw new Error("Invalid cloud metadata.");
  }
  const payload = encodeSave(decodeSave(s.payload));
  if (payload !== s.payload || (await sha(payload)) !== s.hash || (await sha(body(s))) !== s.id)
    throw new Error("Cloud snapshot failed validation.");
  return s;
}
