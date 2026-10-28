import { onTestFinished, vi } from "vitest";
import { createCloud } from "../../src/application/cloud";
import type { CloudIdentity, CloudPort, SaveCandidate } from "../../src/platform/ports";

export const cloudIdentity: CloudIdentity = {
  available: true,
  device: "a".repeat(32),
  profile: "b".repeat(32),
  importAvailable: false,
};

/** In-memory transport shared by controller and session boundary scenarios. */
export function cloudTransport({
  identity = { ...cloudIdentity },
  standalone = [],
}: {
  identity?: CloudIdentity;
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
  return { port, files, local, preserve };
}

/** Each scenario drives the real controller; the fixture owns its final disposal. */
export function cloudFixture({
  publish = () => {},
  ...options
}: Parameters<typeof cloudTransport>[0] & { publish?: Parameters<typeof createCloud>[1] } = {}) {
  const transport = cloudTransport(options);
  const install = vi.fn(async (_data: string, _owns?: () => boolean) => {});
  const manager = createCloud(transport.port, publish, install);
  onTestFinished(() => manager.dispose());
  return { ...transport, manager, install };
}
