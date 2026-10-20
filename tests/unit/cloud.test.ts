import { expect, it, vi } from "vitest";
import { createCloud, snapshot, parseSnapshot, cloudName, newestHeads } from "../../src/application/cloud";
import { createGame, dispatch } from "../../src/game/engine";
import { encodeSave, decodeSave } from "../../src/game/save";
import type { CloudIdentity, CloudPort } from "../../src/platform/ports";
const identity: CloudIdentity = {
  available: true,
  device: "a".repeat(32),
  profile: "b".repeat(32),
  importAvailable: false,
};
const other = { ...identity, device: "c".repeat(32) };
const initial = encodeSave(decodeSave(encodeSave(createGame(7))));
const progress = encodeSave(
  decodeSave(encodeSave(dispatch(createGame(7), { type: "draft", species: "mossback" }).state)),
);
function fixture() {
  const files = new Map<string, string>(),
    local = { data: null as string | null };
  const preserve = vi.fn(async (_records: string[]) => {});
  const port: CloudPort = {
    identity: async () => identity,
    readLocal: async () => local.data,
    writeLocal: async (data) => {
      local.data = data;
    },
    preserve,
    importStandalone: async () => [],
    list: async () => [...files.keys()],
    read: async (name) => files.get(name) ?? null,
    write: async (name, data) => {
      files.set(name, data);
    },
  };
  const install = vi.fn(async (_data: string) => {});
  const manager = createCloud(port, () => {}, install);
  return { manager, port, files, local, install, preserve };
}
it("validates payload bytes, metadata and slot hashes", async () => {
  const s = await snapshot(initial, identity, 1);
  expect(await parseSnapshot(JSON.stringify(s), identity.profile)).toEqual(s);
  await expect(
    parseSnapshot(JSON.stringify({ ...s, payload: progress }), identity.profile),
  ).rejects.toThrow();
  await expect(parseSnapshot(JSON.stringify(s), "wrong-account")).rejects.toThrow();
});
it("uploads only after durable local metadata, keeping devices in distinct slots", async () => {
  const f = fixture();
  const remote = await snapshot(initial, other, 4);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.start(null);
  await f.manager.flush();
  expect(f.install).toHaveBeenCalledWith(initial);
  expect(f.files.get(cloudName(remote))).toBe(JSON.stringify(remote));
  expect([...f.files.keys()].some((k) => k.includes(identity.device))).toBe(true);
  expect(f.local.data).toBeTruthy();
  f.manager.dispose();
});
it("preserves both divergent heads before choosing and resolves without merging currency", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.start(initial);
  expect(f.manager.view.status).toBe("Conflict");
  expect(f.manager.view.blocking).toBe(true);
  expect(f.preserve).toHaveBeenCalled();
  expect(f.install).not.toHaveBeenCalled();
  await f.manager.choose(remote.id);
  await f.manager.flush();
  expect(f.install).toHaveBeenCalledWith(progress);
  expect(f.manager.view.blocking).toBe(false);
  const resolved = await parseSnapshot(f.local.data!, identity.profile);
  expect(resolved.ancestors).toContain(remote.id);
  expect(newestHeads([resolved, remote])).toEqual([resolved]);
  f.manager.dispose();
});
it("keeps unknown remote progress intact during outages and permits explicit offline play", async () => {
  const f = fixture();
  f.port.list = async () => {
    throw new Error("offline");
  };
  await f.manager.start(initial);
  expect(f.manager.view.status).toBe("Pending");
  expect(f.files.size).toBe(0);
  f.manager.offline();
  await f.manager.commit(progress);
  expect(f.manager.view.blocking).toBe(false);
  expect(f.files.size).toBe(0);
  expect((await parseSnapshot(f.local.data!, identity.profile)).payload).toBe(progress);
  f.manager.dispose();
});
it("does not install a late read after offline takeover or disposal", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  f.port.list = async () => {
    await gate;
    return [...f.files.keys()];
  };
  const start = f.manager.start(null);
  await vi.waitFor(() => expect(f.manager.view.status).toBe("Syncing"));
  f.manager.offline();
  release();
  await start;
  expect(f.install).not.toHaveBeenCalled();
  f.manager.dispose();
});
it("refuses replacement when durable conflict preservation fails", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  f.port.preserve = async () => {
    throw new Error("disk full");
  };
  await f.manager.start(initial);
  expect(f.manager.view.blocking).toBe(true);
  expect(f.install).not.toHaveBeenCalled();
  expect(f.files.size).toBe(1);
  f.manager.dispose();
});
it("falls back to a valid remote recovery slot and pauses uploads if another slot is invalid", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  f.files.set(cloudName({ device: other.device, sequence: 2 }), "corrupt");
  await f.manager.start(null);
  expect(f.install).toHaveBeenCalledWith(progress);
  expect(f.manager.view.status).toBe("Pending");
  expect(f.files.size).toBe(2);
  f.manager.dispose();
});
it("does not upload after failed local metadata persistence", async () => {
  const f = fixture();
  await f.manager.start(null);
  f.port.writeLocal = async () => {
    throw new Error("disk full");
  };
  await f.manager.commit(progress);
  expect(f.manager.view.status).toBe("Pending");
  expect(f.files.size).toBe(0);
  f.manager.dispose();
});
it("automatically selects only proven descendants and keeps unrelated offline branches conflicting", async () => {
  const f = fixture();
  const ancestor = await snapshot(initial, identity, 1);
  f.local.data = JSON.stringify(ancestor);
  const remote = await snapshot(progress, other, 1, [ancestor]);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.start(initial);
  await f.manager.flush();
  expect(f.install).toHaveBeenCalledWith(progress);
  expect(f.manager.view.status).not.toBe("Conflict");
  f.manager.dispose();
});
it("retries a failed selected-save installation without dropping the conflict", async () => {
  const f = fixture();
  const remote = await snapshot(progress, other, 1);
  f.files.set(cloudName(remote), JSON.stringify(remote));
  await f.manager.start(initial);
  f.install.mockRejectedValueOnce(new Error("disk full"));
  await f.manager.choose(remote.id);
  expect(f.manager.view.status).toBe("Conflict");
  expect(f.manager.view.blocking).toBe(true);
  await f.manager.choose(remote.id);
  expect(f.manager.view.blocking).toBe(false);
  await f.manager.flush();
  f.manager.dispose();
});
