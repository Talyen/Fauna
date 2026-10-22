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
  status: "Unavailable" | "Syncing" | "Synced" | "Pending";
  blocking: boolean;
  error: string;
}
export const initialCloudView: CloudView = {
  status: "Unavailable",
  blocking: false,
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
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retrying = false;
  let initialized = false;
  let metadataWrites = Promise.resolve();
  const commits = new Set<Promise<void>>();
  const scheduleRetry = () => {
    if (!alive || retryTimer || retrying || identity?.available === false || identity?.enabled === false)
      return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      retrying = true;
      void (initialized ? reconcile(true) : initialize(localData, true)).finally(() => {
        retrying = false;
        if (view.status === "Pending") scheduleRetry();
      });
    }, 15000);
  };
  const update = (patch: Partial<CloudView>) => {
    if (alive) {
      view = { ...view, ...patch };
      publish(view);
      if (view.status === "Pending") scheduleRetry();
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
        update({ status: "Pending", error: errorText(error) });
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
    if (
      current?.payload === data &&
      current.device === identity.device &&
      parents.length === 1 &&
      parents[0]?.id === current.id
    ) {
      upload(current);
      return;
    }
    if (sequence >= Number.MAX_SAFE_INTEGER) throw new Error("Cloud snapshot sequence exhausted.");
    const token = generation;
    const next = await snapshot(data, identity, ++sequence, parents);
    if (!alive || token !== generation) return;
    const writing = metadataWrites.then(async () => {
      if (alive && token === generation) await port.writeLocal(JSON.stringify(next));
    });
    metadataWrites = writing.catch(() => {});
    await writing;
    if (!alive || token !== generation) return;
    current = next;
    localData = next.payload;
    upload(next);
  }
  async function reconcile(background = false) {
    if (!port || !identity?.available || identity.enabled === false) return;
    const token = ++generation;
    remoteReady = false;
    update({
      blocking: !background,
      status: "Syncing",
      error: "",
    });
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
      if (invalid && streams.size === 0) throw new Error("No valid cloud snapshots; remote files preserved.");
      if (background && localData && current?.payload !== localData) await persist(localData);
      if (!alive || token !== generation) return;
      const records = [...streams.values(), ...(current ? [current] : [])];
      const heads = newestHeads(records);
      if (!alive || token !== generation) return;
      if (background && !current) {
        // A running session without durable local metadata must not adopt remote state.
        update({ status: "Pending", blocking: false });
        return;
      }
      if (heads.length) {
        // Prefer this device's intact progress; without it use a stable snapshot ID.
        // Sequence counters are per device and cannot order different devices.
        const chosen =
          (background ? current : null) ??
          heads.find((head) => head.id === current?.id) ??
          [...heads].sort((a, b) => a.id.localeCompare(b.id))[0]!;
        if (heads.length > 1 || (background && !heads.some((head) => head.id === chosen.id))) {
          await port.preserve(records.map((record) => JSON.stringify(record)));
          if (!alive || token !== generation) return;
        }
        if (!background && localData !== chosen.payload) {
          await port.preserve(records.map((s) => JSON.stringify(s)));
          if (!alive || token !== generation) return;
          replacing = true;
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
      if (current) await persist(current.payload, background || heads.length > 1 ? heads : [current]);
      update({
        status: invalid ? "Pending" : current && acknowledged !== current.id ? "Syncing" : "Synced",
        blocking: false,
        error: invalid ? "Some cloud files could not be read. Uploads are paused." : "",
      });
    } catch (error) {
      if (alive && token === generation)
        update({ status: "Pending", blocking: false, error: errorText(error) });
    }
  }
  const offline = () => {
    if (replacing) return false;
    generation++;
    remoteReady = false;
    update({ blocking: false, status: "Pending" });
    return true;
  };
  async function initialize(data: string | null, background = false) {
    const starting = ++generation;
    localData = data;
    if (!port) return;
    try {
      update({ blocking: !background, status: "Syncing" });
      const nextIdentity = await port.identity();
      if (!alive || starting !== generation) return;
      identity = nextIdentity;
      if (!identity.available) {
        update({ ...initialCloudView });
        return;
      }
      if (!identifier.test(identity.device) || !identifier.test(identity.profile))
        throw new Error("Cloud profile identity is invalid.");
      if (!background && identity.importAvailable) {
        const candidates = await port.importStandalone(true);
        if (!alive || starting !== generation) return;
        for (const candidate of candidates) {
          try {
            data = encodeSave(decodeSave(candidate.data));
          } catch {
            continue;
          }
          replacing = true;
          try {
            await install(data);
          } finally {
            replacing = false;
          }
          if (!alive || starting !== generation) return;
          localData = data;
          break;
        }
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
      initialized = true;
      if (data && !current) await persist(data, []);
      if (!alive || starting !== generation) return;
      if (identity.enabled === false) {
        update({ ...initialCloudView });
        return;
      }
      await reconcile(background);
    } catch (error) {
      if (alive && starting === generation)
        update({ status: "Pending", blocking: false, error: errorText(error) });
    }
  }
  async function commit(data: string) {
    if (!alive) return;
    generation++;
    localData = data;
    if (!initialized) {
      if (port && identity?.available !== false) update({ status: "Pending" });
      return;
    }
    try {
      await persist(data);
      if (!remoteReady && identity?.available && identity.enabled !== false) update({ status: "Pending" });
    } catch (error) {
      remoteReady = false;
      update({ status: "Pending", error: errorText(error) });
    }
  }
  return {
    get view() {
      return view;
    },
    async start(data: string | null) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          initialize(data),
          new Promise<void>((resolve) => {
            timer = setTimeout(() => {
              if (offline()) resolve();
            }, 5000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    commit(data: string) {
      const operation = commit(data);
      commits.add(operation);
      void operation.finally(() => commits.delete(operation));
      return operation;
    },
    retry: reconcile,
    offline,
    async flush(timeout = 2000) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        (async () => {
          await Promise.all([...commits, metadataWrites]);
          // Commits may start an upload after hashing and local metadata persistence.
          await running;
        })(),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, timeout);
        }),
      ]);
      clearTimeout(timer);
    },
    dispose() {
      alive = false;
      clearTimeout(retryTimer);
      generation++;
      remoteReady = false;
      return metadataWrites;
    },
  };
}
