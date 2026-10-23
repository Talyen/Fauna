import { expect, it } from "vitest";
import { newestHeads, reconciliationPlan } from "../../../src/application/cloud-policy";
import type { CloudSnapshot } from "../../../src/application/cloud-snapshots";

function head(id: string, ancestors: string[] = [], sequence = 1): CloudSnapshot {
  return {
    version: 1,
    device: id,
    profile: "profile",
    sequence,
    payload: `save-${id}`,
    hash: id,
    id,
    ancestors,
  };
}

it("keeps competing heads in input order and uses only the last record for duplicate identities", () => {
  const retired = head("retired");
  const competing = head("competing");
  const stale = head("updated", [competing.id]);
  const descendant = head("descendant", [retired.id, "missing"]);
  const updated = head("updated", [descendant.id, retired.id], 2);
  const records = [retired, stale, competing, descendant, updated];
  expect(newestHeads(records)).toEqual([updated, competing]);
  expect(records).toEqual([retired, stale, competing, descendant, updated]);
  expect(newestHeads([])).toEqual([]);
});

it("adopts a proven descendant at startup and preserves alternatives before installation", () => {
  const current = head("local"),
    remote = head("remote", [current.id]);
  const plan = reconciliationPlan({ current, remote: [remote], localData: current.payload, mode: "startup" });
  expect(plan.chosen).toBe(remote);
  expect(plan.install).toBe(remote.payload);
  expect(plan.preserve).toBe(true);
  expect(plan.records).toEqual([remote, current]);
  expect(plan.parents).toEqual([remote]);
});

it("retains the running local journey even when a remote descendant has a larger sequence", () => {
  const current = head("local"),
    remote = head("remote", [current.id], 999);
  const plan = reconciliationPlan({
    current,
    remote: [remote],
    localData: current.payload,
    mode: "background",
  });
  expect(plan.chosen).toBe(current);
  expect(plan.install).toBeNull();
  expect(plan.preserve).toBe(true);
  expect(plan.parents).toEqual([remote]);
});

it("resolves unknown ancestry by intact local identity, then stable ID, never sequence", () => {
  const current = head("local"),
    first = head("a", [], 1),
    second = head("z", [], 999);
  const local = reconciliationPlan({
    current,
    remote: [second, first],
    localData: current.payload,
    mode: "startup",
  });
  expect(local.chosen).toBe(current);
  expect(local.parents).toEqual([second, first, current]);
  expect(local.preserve).toBe(true);
  const remote = reconciliationPlan({
    current: null,
    remote: [second, first],
    localData: null,
    mode: "startup",
  });
  expect(remote.chosen).toBe(first);
  expect(remote.preserve).toBe(true);
});

it("defers background reconciliation without durable local ancestry", () => {
  const plan = reconciliationPlan({
    current: null,
    remote: [head("remote")],
    localData: "unsynced",
    mode: "background",
  });
  expect(plan.deferred).toBe(true);
  expect(plan.chosen).toBeNull();
  expect(plan.install).toBeNull();
});
