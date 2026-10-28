import { expect, it } from "vitest";
import { summarizeSample } from "../../../scripts/performance/metrics.mjs";

const sample = () => ({
  frames: Array.from({ length: 80 }, (_, index) => ({
    start: index * 16,
    end: (index + 1) * 16,
    duration: 16,
  })),
  focused: true,
  visibility: "visible",
  segments: [{ name: "play", start: 0, end: 1280, duration: 1280, frames: 80, complete: true }],
  longTasks: null,
  input: null,
});

it("rejects gaps omitted between recorded frames", () => {
  const input = sample();
  input.frames[30] = { start: 490, end: 496, duration: 6 };
  expect(() => summarizeSample(input)).toThrow("frame samples");
  const overlapping = sample();
  overlapping.frames[30] = { start: 479.995, end: 496, duration: 16.005 };
  expect(() => summarizeSample(overlapping)).toThrow("frame samples");
});

it("rejects negative frame timestamps on the renderer clock", () => {
  const input = sample();
  input.frames[0] = { start: -1, end: 16, duration: 17 };
  expect(() => summarizeSample(input)).toThrow("frame samples");
});

it("rejects overlapping action segments", () => {
  const input = sample();
  input.segments = [
    { name: "first", start: 0, end: 700, duration: 700, frames: 40, complete: true },
    { name: "second", start: 600, end: 1200, duration: 600, frames: 40, complete: true },
  ];
  expect(() => summarizeSample(input)).toThrow("action segment");
});

it("rejects action segments entirely outside the recorded frame timeline", () => {
  const input = sample();
  input.segments = [{ name: "play", start: 2000, end: 3000, duration: 1000, frames: 40, complete: true }];
  expect(() => summarizeSample(input)).toThrow("action segment");
});

it("rejects negative browser observer and semantic span timestamps", () => {
  const input = sample();
  expect(() => summarizeSample({ ...input, longTasks: [{ start: -1, duration: 10 }] })).toThrow("observer");
  expect(() => summarizeSample({ ...input, spans: [{ start: -1, end: 5 }] })).toThrow("span");
  expect(summarizeSample(input).frames).toBe(80);
});
