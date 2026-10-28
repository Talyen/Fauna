import { onTestFinished, vi } from "vitest";
import { createCloud } from "../../src/application/cloud";
import type { CloudIdentity, CloudPort, SaveCandidate } from "../../src/platform/ports";

export const cloudIdentity: CloudIdentity = {
  available: true,
  device: "a".repeat(32),
  profile: "b".repeat(32),
  importAvailable: false,
};

/** In-memory transport only; each scenario still drives the real Cloud manager. */
export function cloudFixture({
  identity = { ...cloudIdentity },
  publish = () => {},
  standalone = [],
}: {
  identity?: CloudIdentity;
  publish?: Parameters<typeof createCloud>[1];
  standalone?: SaveCandidate[];
} = {}) {
  const files = new Map<string, string>();
  const local = { data: null as string | null };
  const preserve = vi.fn(async (_records: string[]) => {});
  const port: CloudPort = {
    identity: vi.fn(async () => identity),
    readLocal: async () => local.data,
    writeLocal: vi.fn(async (data: string) => {
      local.data = data;
    }),
    preserve,
    importStandalone: vi.fn(async () => standalone),
    list: vi.fn(async () => [...files.keys()]),
    read: async (name) => files.get(name) ?? null,
    write: vi.fn(async (name: string, data: string) => {
      files.set(name, data);
    }),
  };
  const install = vi.fn(async (_data: string, _owns?: () => boolean) => {});
  const manager = createCloud(port, publish, install);
  onTestFinished(() => manager.dispose());
  return { manager, port, files, local, install, preserve };
}
