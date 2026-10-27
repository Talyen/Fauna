import { expect, it, vi } from "vitest";
import { createDiagnostics } from "../../../src/application/diagnostics";

it("recovers valid diagnostic entries without trusting malformed fields or retaining extra data", () => {
  const diagnostics = createDiagnostics({
    read: () =>
      JSON.stringify([
        null,
        true,
        { source: "unknown", message: "ignore", count: 1 },
        { source: "global", message: {}, count: 1 },
        {
          source: "cloud",
          message: "token=private-credential",
          count: 2_000_000,
          revision: 12,
          phase: "battle".repeat(10),
          payload: "unvalidated data",
        },
        { source: "save-read", message: "retry", count: -1, revision: "12", phase: "battle" },
        { source: "audio", message: "unavailable", count: 1.5, revision: 12, phase: null },
      ]),
    write: vi.fn(),
  });

  expect(diagnostics.snapshot()).toEqual([
    {
      source: "cloud",
      message: "[redacted]",
      count: 1_000_000,
      revision: 12,
      phase: "battle".repeat(10).slice(0, 40),
    },
    { source: "save-read", message: "retry", count: 1 },
    { source: "audio", message: "unavailable", count: 1 },
  ]);
});

it("keeps diagnostic history and live context within the same bounds after reloading", () => {
  let stored = JSON.stringify(
    Array.from({ length: 55 }, (_, index) => ({ source: "global", message: `failure ${index}`, count: 1 })),
  );
  const port = {
    read: () => stored,
    write: (data: string) => {
      stored = data;
    },
  };
  const diagnostics = createDiagnostics(port);
  expect(diagnostics.snapshot()).toHaveLength(50);
  expect(diagnostics.snapshot()[0]!.message).toBe("failure 5");

  diagnostics.record("save-write", "disk full", { revision: 12, phase: "battle".repeat(10) });

  expect(diagnostics.snapshot()).toHaveLength(50);
  expect(diagnostics.snapshot().at(-1)?.phase).toHaveLength(40);
  expect(createDiagnostics(port).snapshot()).toEqual(diagnostics.snapshot());
});

it.each([
  "Authorization: Bearer private-credential",
  'request failed: {"token":"private-credential"}',
  'request failed: {"access_token":"private-credential"}',
  'secret="private \\"credential\\""',
  "password='private credential with spaces'",
])("redacts complete credentials before publication and persistence: %s", (message) => {
  const write = vi.fn();
  const diagnostics = createDiagnostics({ read: () => null, write });
  diagnostics.record("global", message);
  expect(JSON.stringify(diagnostics.snapshot())).not.toContain("private");
  expect(write.mock.calls[0]![0]).not.toContain("private");
  expect(write.mock.calls[0]![0]).not.toContain("credential");
  expect(diagnostics.snapshot()[0]!.message).toContain("[redacted]");
});

it("prevents diagnostic consumers from corrupting retained and persisted evidence", () => {
  const write = vi.fn();
  const diagnostics = createDiagnostics({
    read: () => JSON.stringify([{ source: "save-write", message: "disk full", count: 1 }]),
    write,
  });
  const snapshot = diagnostics.snapshot();
  expect(() => Reflect.set(snapshot[0]!, "message", "tampered")).not.toThrow();
  Reflect.set(snapshot, "length", 0);
  diagnostics.record("save-write", "disk full");
  expect(diagnostics.snapshot()).toEqual([{ source: "save-write", message: "disk full", count: 2 }]);
  expect(JSON.parse(write.mock.calls[0]![0])).toEqual(diagnostics.snapshot());
  expect(snapshot).toEqual([{ source: "save-write", message: "disk full", count: 1 }]);
});

it("owns diagnostic collection before inspecting reentrant error messages", () => {
  const write = vi.fn();
  const diagnostics = createDiagnostics({ read: () => null, write });
  const error = new Error();
  Object.defineProperty(error, "message", {
    get() {
      diagnostics.record("global", "recursive inspection");
      return "disk failure";
    },
  });

  diagnostics.record("save-write", error);

  expect(diagnostics.snapshot()).toEqual([{ source: "save-write", message: "disk failure", count: 1 }]);
  expect(write).toHaveBeenCalledTimes(1);
});

it("revokes an in-progress record when error inspection disposes collection", () => {
  const write = vi.fn();
  const diagnostics = createDiagnostics({ read: () => null, write });
  const listener = vi.fn();
  diagnostics.subscribe(listener);
  const error = new Error();
  Object.defineProperty(error, "message", {
    get() {
      diagnostics.dispose();
      return "late failure";
    },
  });

  diagnostics.record("save-write", error);

  expect(diagnostics.snapshot()).toEqual([]);
  expect(write).not.toHaveBeenCalled();
  expect(listener).not.toHaveBeenCalled();
});

it("retains the newest diagnostics that fit the serialized size limit", () => {
  let stored = "";
  const diagnostics = createDiagnostics({
    read: () => null,
    write: (value) => {
      stored = value;
    },
  });
  const entries = Array.from({ length: 40 }, (_, index) => ({
    source: "global" as const,
    message: `${index}:` + "\u0001".repeat(1190),
    count: 1,
  }));
  for (const entry of entries) diagnostics.record(entry.source, entry.message);
  const retained = diagnostics.snapshot();
  expect(retained.length).toBeLessThan(entries.length);
  expect(retained).toEqual(entries.slice(-retained.length));
  expect(stored.length).toBeLessThan(100_000);
  expect(JSON.stringify(entries.slice(-retained.length - 1)).length).toBeGreaterThanOrEqual(100_000);
  expect(createDiagnostics({ read: () => stored, write: () => {} }).snapshot()).toEqual(retained);
});
