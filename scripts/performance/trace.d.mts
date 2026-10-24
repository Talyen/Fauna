import type { Page } from "@playwright/test";
import type { FrameInterval } from "./metrics.mjs";
export interface TraceEvent {
  name: string;
  pid: number;
  tid: number;
  ph: string;
  ts: number;
  dur?: number;
  args?: { data?: Record<string, unknown> };
}
export interface TraceArtifact {
  traceEvents?: TraceEvent[];
  dataLossOccurred?: boolean;
}
export type TraceAttribution =
  | { available: false; reason: string }
  | {
      available: true;
      thread: { pid: number; tid: number };
      hitches: Array<{
        start: number;
        end: number;
        work: Array<{
          category: string;
          name: string;
          url: string | null;
          line: number | null;
          selfMs: number;
        }>;
        unaccountedMs: number;
      }>;
    };
export function beginTrace(page: Page, file: string): Promise<() => Promise<TraceArtifact | null>>;
export function attributeTrace(
  trace: TraceArtifact,
  sample: { markerStart?: number; markerEnd?: number },
  hitches: FrameInterval[],
): TraceAttribution;
