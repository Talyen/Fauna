import { expect, it, vi } from "vitest";
import { createDiagnostics } from "../../../src/application/diagnostics";

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
