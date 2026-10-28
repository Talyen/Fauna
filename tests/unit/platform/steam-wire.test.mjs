import { it, expect } from "vitest";
import { parseRequest, parseReply } from "../../../desktop/steam-wire.cjs";
const slot = `fauna-v1-${"a".repeat(32)}-0.json`;
it("rejects malformed native requests and results before they reach application capabilities", () => {
  expect(parseRequest({ id: 1, operation: "init", args: [123] }).args).toEqual([123]);
  expect(parseRequest({ id: 2, operation: "read", args: [slot] }).operation).toBe("read");
  for (const request of [
    null,
    {},
    { id: 0, operation: "list", args: [] },
    { id: 1, operation: "read", args: [] },
    { id: 1, operation: "write", args: ["slot", {}] },
    { id: 1, operation: "init", args: [-1] },
    { id: 1, operation: "dispose", args: [] },
  ])
    expect(() => parseRequest(request)).toThrow("Invalid Steam request");
  for (const [operation, value] of [
    ["init", "../profile"],
    ["enabled", "true"],
    ["list", ["slot", 1]],
    ["read", {}],
    ["write", null],
    ["write", false],
  ])
    expect(() => parseReply(operation, value)).toThrow("Invalid Steam response");
  expect(parseReply("read", null)).toBeNull();
  expect(parseReply("enabled", false)).toBe(false);
  expect(parseReply("list", [slot])).toEqual([slot]);
});
