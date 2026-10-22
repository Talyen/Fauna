import { expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createResourceHandler } from "../../../desktop/protocol.cjs";
import { createRecovery } from "../../../desktop/recovery.cjs";

it("serves only application files, rejects foreign origins and methods, and confines symlinks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fauna-protocol-"));
  try {
    const dist = path.join(root, "dist");
    await mkdir(dist);
    await writeFile(path.join(dist, "index.html"), "Fauna");
    await writeFile(path.join(root, "save.json"), "private");
    const fetchFile = vi.fn(async () => new Response("Fauna"));
    const handle = createResourceHandler(dist, fetchFile);
    expect(await (await handle(new Request("fauna://app/index.html"))).text()).toBe("Fauna");
    for (const url of [
      "fauna://foreign/index.html",
      "file:///save.json",
      "fauna://app/%2e%2e%2fsave.json",
      "fauna://app/%5c..%5csave.json",
      "fauna://app/index.html?secret",
      "fauna://app/missing",
      "fauna://app/",
    ])
      expect((await handle(new Request(url))).status).toBe(404);
    expect((await handle(new Request("fauna://app/index.html", { method: "POST" }))).status).toBe(405);
    expect(await (await handle(new Request("fauna://app/index.html", { method: "HEAD" }))).text()).toBe("");
    // Windows junctions do not require symlink privileges on hosted runners.
    await symlink(root, path.join(dist, "escape"), "junction");
    expect((await handle(new Request("fauna://app/escape/save.json"))).status).toBe(404);
    expect(fetchFile).toHaveBeenCalledTimes(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("finishes admitted saves before bounded crash recovery and retains only local platform facts", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-crash-"));
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const reload = vi.fn(async () => {});
  let closing = false;
  const recovery = createRecovery({ directory, drain: () => pending, reload, closing: () => closing });
  try {
    const operation = recovery.recover({ reason: "crashed", exitCode: 1, save: "private" });
    expect(reload).not.toHaveBeenCalled();
    release();
    await operation;
    expect(reload).toHaveBeenCalledOnce();
    await recovery.recover({ reason: "crashed", exitCode: 2 });
    await recovery.recover({ reason: "crashed", exitCode: 3 });
    expect(reload).toHaveBeenCalledTimes(2);
    const record = JSON.parse(await readFile(path.join(directory, "renderer-crash.json"), "utf8"));
    expect(record).toMatchObject({ reason: "crashed", attempt: 3 });
    expect(record).not.toHaveProperty("save");
    closing = true;
    const shutdown = createRecovery({ directory, drain: async () => {}, reload, closing: () => closing });
    await shutdown.recover({ reason: "killed", exitCode: 1 });
    expect(reload).toHaveBeenCalledTimes(2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
