import {
  cloudIdentifier,
  isCloudName,
  cloudName,
  parseSnapshot,
  snapshot,
  type CloudSnapshot,
} from "./cloud-snapshots";
import { reconciliationPlan } from "./cloud-policy";
import { decodeSave, encodeSave } from "../game/save";
import type { CloudIdentity, CloudPort } from "../platform/ports";
export interface CloudView {
  readonly status: "Unavailable" | "Syncing" | "Synced" | "Pending";
  readonly blocking: boolean;
  readonly error: string;
}
export const initialCloudView: CloudView = Object.freeze({
  status: "Unavailable",
  blocking: false,
  error: "",
});
async function bounded(operation: Promise<void>, timeout: number, expired: () => void = () => {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          expired();
          resolve();
        }, timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
/** Local commits never await transport. Reconciliation is the only owner of snapshot replacement. */
export function createCloud(
  port: CloudPort | undefined,
  publish: (view: CloudView) => void,
  install: (data: string, owns?: () => boolean) => Promise<void>,
) {
  let view = initialCloudView,
    identity: CloudIdentity | undefined,
    current: CloudSnapshot | null = null;
  let lifecycle: "new" | "starting" | "ready" | "disposed" = "new";
  const alive = () => lifecycle !== "disposed";
  const owns = (token: number) => alive() && token === generation;
  let generation = 0,
    remoteReady = false,
    sequence = 0;
  let pending: CloudSnapshot | null = null,
    running: Promise<void> | null = null;
  let localData: string | null = null;
  let acknowledged: string | null = null;
  let durable: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retrying = false;
  let retryOperation: Promise<void> | undefined;
  let startup: Promise<void> | undefined;
  let metadataWrites = Promise.resolve();
  const scheduleRetry = () => {
    if (!alive() || retryTimer || retrying || identity?.available === false || identity?.enabled === false)
      return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      retrying = true;
      void retry(true).finally(() => {
        retrying = false;
        if (view.status === "Pending") scheduleRetry();
      });
    }, 15000);
  };
  const update = (patch: Partial<CloudView>) => {
    if (alive()) {
      view = Object.freeze({ ...view, ...patch });
      try {
        publish(view);
      } catch {
        // Observers cannot cancel persistence, transport or retry scheduling.
      }
      if (view.status === "Pending") scheduleRetry();
      else {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    }
  };
  const errorText = (error: unknown) => {
    try {
      if (error instanceof Error) {
        const message: unknown = error.message;
        if (typeof message === "string") return message;
      }
    } catch {
      // A transport error can expose a throwing message getter.
    }
    return "Cloud sync failed.";
  };
  async function drain() {
    while (alive() && remoteReady && pending && port) {
      const item = pending;
      pending = null;
      update({ status: "Syncing", error: "" });
      // Status subscribers can synchronously revoke transport admission.
      if (!alive() || !remoteReady) return;
      try {
        const name = cloudName(item);
        await port.write(name, JSON.stringify(item));
        if (!alive() || !remoteReady) return;
        const confirmation = await port.read(name);
        if (!alive() || !remoteReady) return;
        if (!confirmation || (await parseSnapshot(confirmation, item.profile)).id !== item.id)
          throw new Error("Cloud upload could not be verified.");
        if (!alive() || !remoteReady) return;
        await port.acknowledge?.(item.id);
        if (!alive() || !remoteReady) return;
        acknowledged = item.id;
        if (current?.id === item.id && localData === item.payload) update({ status: "Synced" });
      } catch (error) {
        if (!alive() || !remoteReady) return;
        if (!pending) pending = item;
        remoteReady = false;
        update({ status: "Pending", error: errorText(error) });
      }
    }
  }
  function upload(item: CloudSnapshot) {
    pending = item;
    if (remoteReady) update({ status: "Syncing" });
    if (!running && remoteReady && alive())
      running = drain().finally(() => {
        running = null;
        if (pending && remoteReady && alive()) upload(pending);
      });
  }
  function persist(data: string, parents?: CloudSnapshot[], localCommit = false) {
    const admitted = generation;
    const writing = metadataWrites.then(async () => {
      if (!alive() || (!localCommit && !owns(admitted))) return;
      if (localCommit) {
        generation++;
        localData = data;
        if (identity?.available && identity.enabled !== false && current?.payload !== data)
          update({ status: "Syncing" });
        if (lifecycle !== "ready") {
          if (port && identity?.available !== false) update({ status: "Pending" });
          return;
        }
      }
      if (!port || !identity?.available) return;
      const ancestry = parents ?? (current ? [current] : []);
      if (
        current?.payload === data &&
        durable === current.id &&
        current.device === identity.device &&
        ancestry.length === 1 &&
        ancestry[0]?.id === current.id
      ) {
        if (!localCommit || acknowledged !== current.id) upload(current);
        return;
      }
      if (sequence >= Number.MAX_SAFE_INTEGER) throw new Error("Cloud snapshot sequence exhausted.");
      const token = generation;
      const next = await snapshot(data, identity, ++sequence, ancestry);
      if (!owns(token)) return;
      await port.writeLocal(JSON.stringify(next));
      durable = next.id;
      if (!owns(token)) return;
      current = next;
      localData = next.payload;
      upload(next);
    });
    metadataWrites = writing.catch(() => {});
    return writing;
  }
  async function readInventory(port: CloudPort, identity: CloudIdentity, token: number) {
    const files = (await port.list()).filter(isCloudName);
    if (!owns(token)) return;
    if (files.length > 64) throw new Error("Cloud device limit reached. Local progress remains available.");
    const streams = new Set<string>();
    const remote: CloudSnapshot[] = [];
    let invalid = false;
    for (const name of files) {
      try {
        const raw = await port.read(name);
        if (!owns(token)) return;
        if (!raw) throw new Error("Cloud slot is unreadable.");
        const record = await parseSnapshot(raw, identity.profile);
        if (!owns(token)) return;
        if (cloudName(record) !== name) throw new Error("Cloud slot identity differs.");
        streams.add(record.device);
        remote.push(record);
        if (record.device === identity.device) sequence = Math.max(sequence, record.sequence);
      } catch {
        invalid = true;
      }
    }
    if (!owns(token)) return;
    if (streams.size + Number(!streams.has(identity.device)) > 32)
      throw new Error("Cloud device limit reached. Local progress remains available.");
    if (invalid && streams.size === 0) throw new Error("No valid cloud snapshots; remote files preserved.");
    return { remote, invalid };
  }
  async function reconcile(background = false, initialization?: number, recoverEmpty = false) {
    if (!alive() || !port || !identity?.available || identity.enabled === false) return;
    // Startup retains its lease through reconciliation so its deadline covers remote reads too.
    const token = initialization ?? ++generation;
    remoteReady = false;
    update({
      blocking: !background,
      status: "Syncing",
      error: "",
    });
    try {
      // An in-flight write must finish before comparing remote heads.
      await running;
      if (!owns(token)) return;
      const inventory = await readInventory(port, identity, token);
      if (!inventory || !owns(token)) return;
      const { remote, invalid } = inventory;
      if (background && localData && current?.payload !== localData) await persist(localData);
      if (!owns(token)) return;
      const plan = reconciliationPlan({
        current,
        remote,
        localData,
        mode: background && !recoverEmpty ? "background" : "startup",
      });
      if (plan.deferred) {
        update({ status: "Pending", blocking: false });
        return;
      }
      if (plan.preserve) {
        await port.preserve(plan.records.map((record) => JSON.stringify(record)));
        if (!owns(token)) return;
      }
      if (plan.install !== null) {
        await install(plan.install, () => owns(token));
        if (!owns(token)) return;
        localData = plan.install;
      }
      current = plan.chosen;
      remoteReady = !invalid;
      if (current) await persist(current.payload, plan.parents);
      if (!owns(token)) return;
      update({
        status: invalid ? "Pending" : current && acknowledged !== current.id ? "Syncing" : "Synced",
        blocking: false,
        error: invalid ? "Some cloud files could not be read. Uploads are paused." : "",
      });
    } catch (error) {
      if (owns(token)) update({ status: "Pending", blocking: false, error: errorText(error) });
    }
  }
  const offline = () => {
    if (!alive()) return false;
    generation++;
    remoteReady = false;
    update({ blocking: false, status: identity?.enabled === false ? "Unavailable" : "Pending" });
    return true;
  };
  async function initialize(data: string | null, background = false) {
    if (!alive()) return;
    const starting = ++generation;
    lifecycle = "starting";
    localData = data;
    if (!port) return;
    try {
      update({ blocking: !background, status: "Syncing" });
      if (!owns(starting)) return;
      const nextIdentity = await port.identity();
      if (!owns(starting)) return;
      identity = Object.freeze({ ...nextIdentity });
      if (!identity.available) {
        update({ ...initialCloudView });
        return;
      }
      if (!cloudIdentifier.test(identity.device) || !cloudIdentifier.test(identity.profile))
        throw new Error("Cloud profile identity is invalid.");
      const raw = await port.readLocal();
      if (!owns(starting)) return;
      if (raw) {
        let saved: CloudSnapshot | undefined;
        try {
          saved = await parseSnapshot(raw, identity.profile);
        } catch {
          /* Unknown ancestry stays a conflict, never a fabricated descendant. */
        }
        if (!owns(starting)) return;
        if (saved) {
          sequence = saved.device === identity.device ? saved.sequence : 0;
          durable = saved.id;
          if (saved.payload === data) current = saved;
          else {
            await port.preserve([JSON.stringify(saved)]);
            if (!owns(starting)) return;
            if (data === null && !background) {
              await install(saved.payload, () => owns(starting));
              if (!owns(starting)) return;
              data = saved.payload;
              localData = data;
              current = saved;
            }
          }
        }
      }
      if (!background && data === null && identity.importAvailable) {
        const candidates = await port.importStandalone(true);
        if (!owns(starting)) return;
        for (const candidate of candidates) {
          try {
            data = encodeSave(decodeSave(candidate.data));
          } catch {
            continue;
          }
          await install(data, () => owns(starting));
          if (!owns(starting)) return;
          localData = data;
          break;
        }
      }
      lifecycle = "ready";
      if (data && !current) await persist(data, []);
      if (!owns(starting)) return;
      if (identity.enabled === false) {
        update({ ...initialCloudView });
        return;
      }
      // An automatic retry may recover a remote save when no local game exists,
      // while still keeping local metadata recovery non-blocking and non-installing.
      await reconcile(background, starting, background && data === null);
    } catch (error) {
      if (owns(starting))
        update({
          status: identity?.enabled === false ? "Unavailable" : "Pending",
          blocking: false,
          error: errorText(error),
        });
    }
  }
  async function commit(data: string) {
    try {
      await persist(encodeSave(decodeSave(data)), undefined, true);
      if (identity?.enabled === false) update({ ...initialCloudView });
      else if (!remoteReady && identity?.available) update({ status: "Pending" });
    } catch (error) {
      remoteReady = false;
      update({ status: identity?.enabled === false ? "Unavailable" : "Pending", error: errorText(error) });
    }
  }
  function withDeadline(operation: () => Promise<void>) {
    const token = generation + 1;
    return bounded(operation(), 5000, () => {
      if (owns(token)) offline();
    });
  }
  function retry(forceBackground = false) {
    if (!alive()) return Promise.resolve();
    // Own retry before status publication can synchronously request it again.
    return (retryOperation ??= Promise.resolve()
      .then(() => {
        const background = forceBackground || localData !== null;
        return withDeadline(() =>
          lifecycle === "ready"
            ? reconcile(background, undefined, background && localData === null)
            : initialize(localData, background),
        );
      })
      .finally(() => {
        retryOperation = undefined;
      }));
  }
  return {
    get view() {
      return view;
    },
    start(data: string | null) {
      if (!alive()) return Promise.resolve();
      // Own startup before publishing to subscribers; retries use the latest localData.
      return (startup ??= Promise.resolve().then(() => withDeadline(() => initialize(data))));
    },
    commit,
    retry: () => retry(),
    offline,
    async flush(timeout = 2000) {
      await bounded(
        (async () => {
          let metadata: Promise<void>;
          do {
            metadata = metadataWrites;
            await metadata;
            await running;
          } while (metadata !== metadataWrites || running !== null);
        })(),
        timeout,
      );
    },
    dispose() {
      lifecycle = "disposed";
      clearTimeout(retryTimer);
      generation++;
      remoteReady = false;
      // Gameplay is already durable; optional metadata cannot hold session teardown.
      return bounded(metadataWrites, 2000);
    },
  };
}
