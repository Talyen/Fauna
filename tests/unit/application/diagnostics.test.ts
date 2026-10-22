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
