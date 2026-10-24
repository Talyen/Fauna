// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { produce } from "immer";
import { teamRun } from "../../support/game";
import type { Command } from "../../../src/game/types";
import { dispatch, previewCard } from "../../../src/game/engine";
import { projectPlay } from "../../../src/game/preview";
import { encodeSave } from "../../../src/game/save";
import { species } from "../../../src/game/content";
import { playPreviewModel } from "../../../src/ui/battle/play-preview-model";
import { TargetPreview } from "../../../src/ui/battle/target-preview";
import { createSession } from "../../../src/application/session";
import { installPerformanceRecorder, measurePerformance } from "../../../src/lib/performance";
import { summarizeSample, comparePerformance } from "../../../scripts/performance/metrics.mjs";
import { attributeTrace } from "../../../scripts/performance/trace.mjs";
import { compareRecorderOverhead } from "../../../scripts/performance/metrics.mjs";
import { performanceCases } from "../../../src/tooling/performance";
import { decodeSave } from "../../../src/game/save";
import * as engine from "../../../src/game/engine";
import { installSampler } from "../../../scripts/performance/sampler.mjs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ready() {
  return produce(teamRun(42, ["cindernewt", "mossguard", "prismram"]), (state) => {
    const card = state.cards.find((entry) => entry.definitionId === "cindernewt-attack")!;
    state.battle!.hand = [card.id];
    state.battle!.buffer = [];
    state.battle!.discard = [];
    state.battle!.draw = state.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    state.battle!.enemies[0]!.combat.dodge = 25;
    state.battle!.enemies[0]!.health = 4;
    state.battle!.enemies[0]!.block = 0;
  });
}

it("projects random damage, criticals and Dodge without reading the seeded answer or changing a later play", () => {
  const game = ready(),
    cardId = game.battle!.hand[0]!;
  const before = encodeSave(game);
  const command = { type: "play" as const, cardId, targetId: "enemy-0", autoEndTurn: false };
  const committed = dispatch(game, command);
  const result = projectPlay(game, cardId, "enemy-0");
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected finite alternatives");
  const events = result.outcomes.flatMap((outcome) => outcome.events);
  expect(events.some((event) => event.kind === "status" && event.outcome === "dodge")).toBe(true);
  expect(events.some((event) => event.kind === "damage" && event.critical)).toBe(true);
  expect(new Set(events.filter((event) => event.kind === "damage").map((event) => event.damageType))).toEqual(
    new Set(["physical", "burn"]),
  );
  const changedSeed = produce(game, (state) => {
    state.rng = 123456;
  });
  expect(playPreviewModel(game, result, "enemy-0")).toEqual(
    playPreviewModel(changedSeed, projectPlay(changedSeed, cardId, "enemy-0"), "enemy-0"),
  );
  expect(encodeSave(game)).toBe(before);
  expect(dispatch(game, command)).toEqual(committed);
});

it("retains Dodge and its retaliation together in the same alternative", () => {
  const game = produce(ready(), (state) => {
    const enemy = state.battle!.enemies[0]!;
    enemy.species = "cindernewt";
    enemy.maxHealth = species("cindernewt").health;
    enemy.health = enemy.maxHealth;
    enemy.combat.dodge = 50;
  });
  const result = projectPlay(game, game.battle!.hand[0]!, "enemy-0");
  expect(result.kind).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected alternatives");
  let dodges = 0;
  for (const outcome of result.outcomes) {
    if (
      !outcome.events.some(
        (event) => event.kind === "status" && event.targetId === "enemy-0" && event.outcome === "dodge",
      )
    )
      continue;
    dodges++;
    expect(
      outcome.events.some(
        (event) => event.kind === "damage" && event.targetId === "ally-0" && event.damageType === "burn",
      ),
    ).toBe(true);
    expect(outcome.state.battle!.enemies[0]!.health).toBe(game.battle!.enemies[0]!.health);
  }
  expect(dodges).toBeGreaterThan(0);
});

it("keeps conditional knockouts conditional and gives every visible branch an accessible explanation", () => {
  const game = ready();
  const forecast = playPreviewModel(
    game,
    projectPlay(game, game.battle!.hand[0]!, "enemy-0"),
    "enemy-0",
  ).units.get("enemy-0");
  const { container } = render(<TargetPreview forecast={forecast} />);
  expect(screen.getByRole("status").getAttribute("aria-label")).toContain("Possible outcomes");
  expect(screen.getByText("Possible knockout")).toBeTruthy();
  expect(container.querySelector(".knockout-preview")).toBeNull();
});

it("preserves exact deterministic forecasts and never treats an unresolved forecast as unchanged", () => {
  const game = ready();
  const exact = previewCard(game, game.battle!.hand[0]!, "enemy-0", () => 0.5);
  const model = playPreviewModel(game, { kind: "complete", outcomes: [exact], replays: 1 }, "enemy-0");
  expect(model.units.get("enemy-0")?.alternatives).toBeUndefined();
  render(
    <TargetPreview
      forecast={playPreviewModel(
        game,
        { kind: "unknown", reason: "budget", replays: 128 },
        "enemy-0",
      ).units.get("enemy-0")}
    />,
  );
  expect(screen.getByText("Outcome varies")).toBeTruthy();
  expect(screen.getByRole("status").getAttribute("aria-label")).toContain("hidden information");
});

it("treats hidden draws as unresolved and rejects unavailable cards without publishing a forecast", () => {
  const game = ready();
  const invalid = projectPlay(game, "missing", "enemy-0");
  expect(playPreviewModel(game, invalid, "enemy-0").units.size).toBe(0);
  // A shuffle after a play must not use the real future deck order as a forecast oracle.
  const hidden = produce(game, (state) => {
    state.battle!.discard = state.battle!.draw;
    state.battle!.draw = [];
  });
  expect(projectPlay(hidden, hidden.battle!.hand[0]!, "enemy-0").kind).toBe("unknown");
});

it("drops incomplete outcome sets when finite branching exceeds the preview budget", () => {
  vi.spyOn(engine, "previewCard").mockImplementation((state, _card, _target, decide) => {
    decide?.({ kind: "index", size: 65 });
    return { accepted: true, state, events: [] };
  });
  expect(projectPlay(ready(), "card", "enemy-0")).toMatchObject({ kind: "unknown", reason: "budget" });
});

it("validates expanded performance fixtures, preview-only checkpoints and isolated diagnostic stalls", () => {
  const cases = performanceCases();
  expect(cases.map((entry) => entry.id)).toEqual(
    expect.arrayContaining(["preview", "area-reactions", "draw-repeat", "battle", "swap", "menus"]),
  );
  expect(cases.some((entry) => entry.id === "diagnostic-stall")).toBe(false);
  expect(performanceCases(42, true).map((entry) => entry.id)).toEqual(["diagnostic-stall"]);
  for (const scenario of cases) {
    let state = decodeSave(scenario.initial);
    for (const action of scenario.actions) {
      if ("command" in action) {
        const result = dispatch(state, action.command as Command);
        expect(result.accepted).toBe(true);
        state = result.state;
      }
      expect(encodeSave(state)).toBe(action.checkpoint);
    }
  }
});

it("a broken performance sink cannot change application results, save ordering or reentrant commands", async () => {
  const data = encodeSave(ready());
  const saved: string[] = [];
  const session = createSession(
    {
      desktop: false,
      saves: {
        readCandidates: async () => [{ source: "primary", data }],
        write: async (value) => {
          saved.push(value);
        },
      },
    },
    1,
    {
      performance: () => {
        throw new Error("sink failed");
      },
    },
  );
  await session.load();
  const first = session.store.getState().game;
  let reentered = false;
  session.store.subscribe((view) => {
    if (view.game.revision > first.revision && !reentered) {
      reentered = true;
      session.command({ type: "endTurn" });
    }
  });
  expect(
    session.command({
      type: "play",
      cardId: first.battle!.hand[0]!,
      targetId: "enemy-0",
      autoEndTurn: false,
    }),
  ).toBe(true);
  await session.flush();
  expect(saved).toHaveLength(2);
  expect(JSON.parse(saved[0]!).revision).toBeLessThan(JSON.parse(saved[1]!).revision);
  await session.dispose();
});

it("recording failures and stale cleanup preserve return values, exceptions and the current recorder", () => {
  const original = new Error("application failed");
  const old = installPerformanceRecorder(() => () => {
    throw new Error("sink failed");
  });
  expect(measurePerformance("example", () => 42)).toBe(42);
  expect(() =>
    measurePerformance("example", () => {
      throw original;
    }),
  ).toThrow(original);
  const current = vi.fn(() => undefined);
  const release = installPerformanceRecorder(current);
  old();
  measurePerformance("example", () => 1);
  expect(current).toHaveBeenCalledTimes(1);
  release();
  const older = installPerformanceRecorder(current);
  const newer = installPerformanceRecorder(current);
  older();
  measurePerformance("same-sink-new-owner", () => 1);
  expect(current).toHaveBeenCalledTimes(2);
  newer();
});

function sample() {
  let now = 0;
  const frames = Array.from({ length: 80 }, (_, index) => {
    const duration = index === 30 ? 35 : index === 50 ? 80 : 16.7;
    const start = now;
    now += duration;
    return { start, end: now, duration };
  });
  const gap = frames[50]!;
  return {
    frames,
    focused: true,
    visibility: "visible",
    markerStart: 0,
    markerEnd: now + 10,
    segments: [
      { name: "play", start: 0, end: gap.start + 20, duration: gap.start + 20, frames: 51, complete: true },
      {
        name: "feedback",
        start: gap.start + 20,
        end: now,
        duration: now - gap.start - 20,
        frames: 29,
        complete: true,
      },
    ],
    spans: [{ name: "preview", start: gap.start + 5, end: gap.end - 5, details: {}, outcome: "complete" }],
    longTasks: [],
    input: null,
    longAnimationFrames: null,
  };
}

it("finds small hitches without long tasks and correlates a cross-action gap by actual timestamps", () => {
  const summary = summarizeSample(sample());
  expect(summary.hitches.map((gap: { duration: number }) => gap.duration)).toEqual([80, 35]);
  expect(summary.hitches[0]!.actions).toEqual(["play", "feedback"]);
  expect(summary.hitches[0]!.spans[0]!.name).toBe("preview");
  expect(summary.hitches[0].longAnimationFrames).toBeNull();
  for (const changed of [{ truncated: true }, { interrupted: true }, { focused: false }])
    expect(() => summarizeSample({ ...sample(), ...changed })).toThrow();
});

it("rejects old, incompatible or incomplete comparisons rather than claiming an improvement", () => {
  const report = {
    format: 3,
    complete: true,
    environment: { trace: false },
    cases: [{ id: "battle", fixture: "v1", checkpointHash: "a", actionHash: "b", sample: sample() }],
  };
  expect(comparePerformance(report, report)[0]!.p95Delta).toBe(0);
  expect(() => comparePerformance(report, { ...report, format: 2 })).toThrow();
  expect(() => comparePerformance(report, { ...report, environment: { trace: true } })).toThrow();
  expect(() => summarizeSample({ ...sample(), frames: sample().frames.reverse() })).toThrow();
});

it("keeps recorder overhead separate from optimization comparisons", () => {
  const report = {
    format: 3,
    buildIdentity: "same-renderer",
    complete: true,
    environment: { trace: false, recordSpans: false },
    cases: [{ id: "preview", fixture: "v1", checkpointHash: "a", actionHash: "b", sample: sample() }],
  };
  const active = { ...report, environment: { ...report.environment, recordSpans: true } };
  expect(() => comparePerformance(report, active)).toThrow();
  expect(compareRecorderOverhead(report, active).kind).toBe("recorder-overhead");
  expect(() => compareRecorderOverhead(report, { ...active, buildIdentity: "changed-renderer" })).toThrow();
  expect(() => compareRecorderOverhead(active, report)).toThrow();
});

it("drains final observer records and revokes the capture bridge, frames and listeners on stop", async () => {
  let now = 0,
    serial = 0,
    disconnected = 0;
  const frames = new Map<number, (time: number) => void>();
  vi.stubGlobal("performance", {
    now: () => now,
    timeOrigin: 123,
    mark: () => ({ startTime: now }),
    clearMarks: () => {},
  });
  vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      static supportedEntryTypes = ["longtask", "event", "long-animation-frame"];
      type = "";
      observe({ type }: { type: string }) {
        this.type = type;
      }
      disconnect() {
        disconnected++;
      }
      takeRecords() {
        return this.type === "longtask" ? [{ name: "final-task", startTime: 10, duration: 80 }] : [];
      }
    },
  );
  const pump = () => {
    now += 17;
    const currentFrame = Array.from(frames.values());
    frames.clear();
    for (const callback of currentFrame) callback(now);
  };
  const installed = installSampler();
  pump();
  pump();
  await installed;
  const capture = Reflect.get(window, "faunaPerf");
  capture.segment("target");
  const end = window.faunaPerformanceCapture?.begin("target-preview", { revision: 3 });
  for (let i = 0; i < 80; i++) pump();
  end?.();
  end?.();
  capture.end();
  const result = capture.stop();
  expect(result.spans).toHaveLength(1);
  expect(result.longTasks).toEqual([{ name: "final-task", start: 10, duration: 80, inputDelay: null }]);
  expect(window.faunaPerformanceCapture).toBeUndefined();
  expect(frames.size).toBe(0);
  expect(disconnected).toBe(3);
  window.dispatchEvent(new Event("blur"));
  expect(result.interrupted).toBe(false);
  expect(capture.stop()).toBe(result);
});

it("aligns deep traces to the measured thread and accounts for nested work exactly once", () => {
  const measured = sample(),
    gap = measured.frames[50]!;
  const event = (name: string, start: number, duration?: number, tid = 2) => ({
    name,
    pid: 1,
    tid,
    ph: duration === undefined ? "I" : "X",
    ts: (1000 + start) * 1000,
    dur: duration === undefined ? undefined : duration * 1000,
  });
  const traceEvents = [
    event("fauna-capture-start", 0),
    event("fauna-capture-end", measured.markerEnd),
    event("FunctionCall", gap.start - 10, 100),
    event("Layout", gap.start + 20, 20),
    event("EvaluateScript", gap.start, 80, 99),
  ];
  const attribution = attributeTrace({ traceEvents }, measured, [gap]);
  expect(attribution.available).toBe(true);
  if (!attribution.available) throw new Error("Expected trace");
  expect(
    attribution.hitches?.[0]?.work.find((row: { category: string }) => row.category === "style/layout")
      ?.selfMs,
  ).toBeCloseTo(20);
  expect(
    attribution.hitches?.[0]?.work.reduce((sum: number, row: { selfMs: number }) => sum + row.selfMs, 0),
  ).toBeCloseTo(80);
  expect(attribution.hitches?.[0]?.unaccountedMs).toBeCloseTo(0);
  expect(attributeTrace({ traceEvents: [] }, measured, [gap]).available).toBe(false);
  expect(attributeTrace({ traceEvents, dataLossOccurred: true }, measured, [gap]).available).toBe(false);
});
