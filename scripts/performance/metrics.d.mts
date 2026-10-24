export interface FrameInterval {
  start: number;
  end: number;
  duration: number;
}
export interface TimedObservation {
  start: number;
  duration: number;
  inputDelay?: number | null;
}
export interface RecordedSpan {
  name: string;
  start: number;
  end: number;
  details: Record<string, unknown>;
  outcome: string;
}
export interface PerformanceSample {
  frames: FrameInterval[];
  segments: Array<FrameInterval & { name?: string; frames: number; complete: boolean }>;
  spans?: RecordedSpan[];
  focused: boolean;
  visibility: string;
  truncated?: boolean;
  interrupted?: boolean;
  longTasks: TimedObservation[] | null;
  input: TimedObservation[] | null;
  longAnimationFrames?: TimedObservation[] | null;
  startupMs?: number | null;
  before?: unknown;
  after?: unknown;
}
export interface Hitch extends FrameInterval {
  actions: Array<string | undefined>;
  spans: Array<Pick<RecordedSpan, "name" | "details" | "outcome">>;
  longTasks: TimedObservation[] | null;
  input: TimedObservation[] | null;
  longAnimationFrames: TimedObservation[] | null;
}
export interface PerformanceSummary {
  hitches: Hitch[];
  startupMs: number | null;
  frames: number;
  p50: number;
  p95: number;
  p99: number;
  gaps: Record<string, number>;
  longTasks: number | null;
  input: TimedObservation[] | null;
  before: unknown;
  after: unknown;
}
export interface PerformanceReport {
  buildIdentity?: string;
  format: number;
  complete: boolean;
  environment: Record<string, unknown>;
  cases: Array<{
    id: string;
    fixture: string;
    checkpointHash: string;
    actionHash: string;
    sample: PerformanceSample;
  }>;
}
export interface PerformanceComparison {
  id: string;
  baseline: PerformanceSummary;
  treatment: PerformanceSummary;
  p95Delta: number;
  startupDelta: number | null;
  gapRatesPer30s: Record<string, { baseline: number; treatment: number }>;
}
export function summarizeSample(sample: PerformanceSample): PerformanceSummary;
export function hitchInventory(sample: PerformanceSample): Hitch[];
export function comparePerformance(
  before: PerformanceReport,
  after: PerformanceReport,
): PerformanceComparison[];
export function compareRecorderOverhead(
  inactive: PerformanceReport,
  active: PerformanceReport,
): { kind: "recorder-overhead"; note: string; cases: PerformanceComparison[] };
export function hitchMarkdown(
  id: string,
  summary: PerformanceSummary,
  trace: import("./trace.mjs").TraceAttribution | null,
): string;
