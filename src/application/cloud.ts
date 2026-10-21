import { decodeSave, encodeSave } from "../game/save";
import type { CloudIdentity, CloudPort } from "../platform/ports";
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
export interface CloudView {
  status: "Unavailable" | "Syncing" | "Synced" | "Pending" | "Conflict";
  blocking: boolean;
  offlineAvailable: boolean;
  importAvailable: boolean;
  candidates: CloudSnapshot[];
  error: string;
}
export const initialCloudView: CloudView = {
  status: "Unavailable",
  blocking: false,
  offlineAvailable: false,
  importAvailable: false,
  candidates: [],
  error: "",
};
const identifier = /^[a-f0-9]{32}$/;
const digest = /^[a-f0-9]{64}$/;
export const cloudName = (s: Pick<CloudSnapshot, "device" | "sequence">) =>
  `fauna-v1-${s.device}-${s.sequence % 2}.json`;
const isCloudName = (name: string) => /^fauna-v1-[a-f0-9]{32}-[01]\.json$/.test(name);
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
    ancestors: [...new Set(parents.flatMap((p) => [p.id, ...p.ancestors]))].slice(0, 64),
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
    !identifier.test(s.device) ||
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
export function newestHeads(records: CloudSnapshot[]) {
  const unique = [...new Map(records.map((s) => [s.id, s])).values()];
  return unique.filter((s) => !unique.some((other) => other.ancestors.includes(s.id)));
}
/** Local commits never await transport. Reconciliation is the only owner of snapshot replacement. */
export function createCloud(
  port: CloudPort | undefined,
  publish: (view: CloudView) => void,
  install: (data: string) => Promise<void>,
) {
  let view = { ...initialCloudView },
    identity: CloudIdentity | undefined,
    current: CloudSnapshot | null = null;
  let alive = true,
    generation = 0,
    remoteReady = false,
    sequence = 0;
  let pending: CloudSnapshot | null = null,
    running: Promise<void> | null = null;
  let localData: string | null = null;
  let replacing = false;
  let acknowledged: string | null = null;
  let importing = false;
  const update = (patch: Partial<CloudView>) => {
    if (alive) {
      view = { ...view, ...patch };
      publish(view);
    }
  };
  const errorText = (error: unknown) => (error instanceof Error ? error.message : "Cloud sync failed.");
  async function drain() {
    while (alive && remoteReady && pending && port) {
      const item = pending;
      pending = null;
      update({ status: "Syncing", error: "" });
      try {
        await port.write(cloudName(item), JSON.stringify(item));
        const confirmation = await port.read(cloudName(item));
        if (!confirmation || (await parseSnapshot(confirmation, item.profile)).id !== item.id)
          throw new Error("Cloud upload could not be verified.");
        if (!alive) return;
        await port.acknowledge?.(item.id);
        acknowledged = item.id;
        if (current?.id === item.id) update({ status: "Synced" });
      } catch (error) {
        if (!pending) pending = item;
        remoteReady = false;
        update({ status: "Pending", error: errorText(error), offlineAvailable: true });
      }
    }
  }
  function upload(item: CloudSnapshot) {
    pending = item;
    if (remoteReady) update({ status: "Syncing" });
    if (!running && remoteReady && alive)
      running = drain().finally(() => {
        running = null;
        if (pending && remoteReady && alive) upload(pending);
      });
  }
  async function persist(data: string, parents: CloudSnapshot[] = current ? [current] : []) {
    if (!port || !identity?.available) return;
    if (current?.payload === data && current.device === identity.device && parents.length <= 1) {
      upload(current);
      return;
    }
    if (sequence >= Number.MAX_SAFE_INTEGER) throw new Error("Cloud snapshot sequence exhausted.");
    const next = await snapshot(data, identity, ++sequence, parents);
    await port.writeLocal(JSON.stringify(next));
    current = next;
    localData = next.payload;
    upload(next);
  }
  async function reconcile() {
    if (!port || !identity?.available || identity.enabled === false) return;
    const token = ++generation;
    remoteReady = false;
    update({ blocking: true, offlineAvailable: false, status: "Syncing", candidates: [], error: "" });
    const timer = setTimeout(() => {
      if (alive && token === generation)
        update({
          status: "Pending",
          offlineAvailable: true,
          error: "Cloud is taking longer than expected. You can play offline.",
        });
    }, 5000);
    try {
      // An in-flight write must finish before comparing remote heads.
      await running;
      const files = (await port.list()).filter(isCloudName);
      if (files.length > 64) throw new Error("Cloud device limit reached. Local progress remains available.");
      const streams = new Map<string, CloudSnapshot>();
      let invalid = false;
      for (const name of files) {
        const raw = await port.read(name);
        if (!raw) {
          invalid = true;
          continue;
        }
        try {
          const record = await parseSnapshot(raw, identity.profile);
          if (cloudName(record) !== name) throw new Error("Cloud slot identity differs.");
          const previous = streams.get(record.device);
          if (!previous || record.sequence > previous.sequence) streams.set(record.device, record);
          if (record.device === identity.device) sequence = Math.max(sequence, record.sequence);
        } catch {
          invalid = true;
        }
      }
      if (!alive || token !== generation) return;
      if (streams.size >= 32 && !streams.has(identity.device))
        throw new Error("Cloud device limit reached. Local progress remains available.");
      if (invalid && streams.size === 0)
        throw new Error(
          "Cloud saves could not be validated. Retry or play offline; remote files were preserved.",
        );
      const records = [...streams.values(), ...(current ? [current] : [])];
      const heads = newestHeads(records);
      if (heads.length > 1 && !heads.every((s) => s.hash === heads[0]!.hash)) {
        // Preserve before offering replacement; no choice can destroy its alternative.
        await port.preserve(heads.map((s) => JSON.stringify(s)));
        if (alive && token === generation)
          update({ status: "Conflict", candidates: heads, blocking: true, offlineAvailable: true });
        return;
      }
      if (!alive || token !== generation) return;
      if (heads.length) {
        const chosen = heads[0]!;
        if (localData !== chosen.payload) {
          await port.preserve(records.map((s) => JSON.stringify(s)));
          if (!alive || token !== generation) return;
          replacing = true;
          clearTimeout(timer);
          update({ offlineAvailable: false });
          try {
            await install(chosen.payload);
          } finally {
            replacing = false;
          }
          if (!alive || token !== generation) return;
          localData = chosen.payload;
        }
        current = chosen;
      }
      remoteReady = !invalid;
      if (current) await persist(current.payload, heads.length > 1 ? heads : [current]);
      update({
        status: invalid ? "Pending" : current && acknowledged !== current.id ? "Syncing" : "Synced",
        blocking: false,
        offlineAvailable: true,
        candidates: [],
        error: invalid ? "Some cloud files could not be read. Uploads are paused." : "",
      });
    } catch (error) {
      if (alive && token === generation)
        update({ status: "Pending", blocking: true, offlineAvailable: true, error: errorText(error) });
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    get view() {
      return view;
    },
    async start(data: string | null) {
      const starting = ++generation;
      localData = data;
      if (!port) return;
      try {
        update({ blocking: true, status: "Syncing" });
        identity = await port.identity();
        if (!alive || starting !== generation) return;
        if (!identity.available) {
          update({ ...initialCloudView });
          return;
        }
        if (!identifier.test(identity.device) || !identifier.test(identity.profile))
          throw new Error("Cloud profile identity is invalid.");
        if (identity.importAvailable) {
          update({ importAvailable: true, blocking: true, status: "Pending" });
          return;
        }
        const raw = await port.readLocal();
        if (!alive || starting !== generation) return;
        if (raw) {
          try {
            const saved = await parseSnapshot(raw, identity.profile);
            sequence = saved.device === identity.device ? saved.sequence : 0;
            if (saved.payload === data) current = saved;
          } catch {
            /* Unknown ancestry stays a conflict, never a fabricated descendant. */
          }
        }
        if (data && !current) await persist(data, []);
        if (!alive || starting !== generation) return;
        if (identity.enabled === false) {
          update({ ...initialCloudView });
          return;
        }
        await reconcile();
      } catch (error) {
        update({ status: "Pending", blocking: true, offlineAvailable: true, error: errorText(error) });
      }
    },
    async commit(data: string) {
      if (!alive) return;
      localData = data;
      try {
        await persist(data);
      } catch (error) {
        remoteReady = false;
        update({ status: "Pending", error: errorText(error) });
      }
    },
    retry: reconcile,
    offline() {
      if (replacing) return;
      generation++;
      remoteReady = false;
      update({
        blocking: false,
        offlineAvailable: true,
        status: view.status === "Conflict" ? "Conflict" : "Pending",
      });
    },
    async choose(id: string) {
      if (!port || !identity || !view.blocking || view.status !== "Conflict") return;
      const candidates = view.candidates,
        chosen = candidates.find((s) => s.id === id);
      if (!chosen) return;
      const token = ++generation;
      update({ status: "Syncing", offlineAvailable: false });
      try {
        await port.preserve(candidates.map((s) => JSON.stringify(s)));
        if (!alive || token !== generation) return;
        await install(chosen.payload);
        if (!alive || token !== generation) return;
        remoteReady = true;
        await persist(chosen.payload, candidates);
        update({ blocking: false, candidates: [], error: "", offlineAvailable: true });
      } catch (error) {
        update({ status: "Conflict", error: errorText(error), offlineAvailable: true });
      }
    },
    async importStandalone(use: boolean) {
      if (!port || !view.importAvailable || importing) return;
      importing = true;
      update({ status: "Syncing", error: "" });
      try {
        const candidates = await port.importStandalone(use);
        if (!alive) return;
        let data: string | null = null;
        for (const candidate of candidates) {
          try {
            data = encodeSave(decodeSave(candidate.data));
            break;
          } catch {
            /* Keep current-format backup recovery. */
          }
        }
        if (use && !data) throw new Error("Standalone saves could not be read. Start separately or retry.");
        if (data) await install(data);
        update({ importAvailable: false });
        await this.start(data ?? localData);
      } catch (error) {
        update({ status: "Pending", error: errorText(error) });
      } finally {
        importing = false;
      }
    },
    async flush(timeout = 2000) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        running,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, timeout);
        }),
      ]);
      clearTimeout(timer);
    },
    dispose() {
      alive = false;
      generation++;
      remoteReady = false;
    },
  };
}
