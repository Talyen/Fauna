import type { PerformanceRecorder } from "../lib/performance";
declare global {
  interface Window {
    faunaPerformanceCapture?: { begin: PerformanceRecorder };
  }
}
// The capture harness owns the clock, inventory and lifecycle; no ordinary-play log is installed.
export const rendererPerformanceRecorder: PerformanceRecorder = (name, details) =>
  window.faunaPerformanceCapture?.begin(name, details);
