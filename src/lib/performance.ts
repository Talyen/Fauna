export type SpanDetails = Readonly<Record<string, string | number | boolean>>;
export type SpanEnd = (outcome?: "complete" | "interrupted" | "failed") => void;
export type PerformanceRecorder = (name: string, details?: SpanDetails) => SpanEnd | undefined;
const noop: SpanEnd = () => {};
const installations: { recorder: PerformanceRecorder }[] = [];

export function installPerformanceRecorder(recorder: PerformanceRecorder) {
  const installation = { recorder };
  installations.push(installation);
  return () => {
    const index = installations.indexOf(installation);
    if (index >= 0) installations.splice(index, 1);
  };
}
/** Recording is optional and cannot replace an application's result or exception. */
export function startPerformanceSpan(
  name: string,
  details?: SpanDetails,
  recorder = installations.at(-1)?.recorder,
): SpanEnd {
  if (!recorder) return noop;
  try {
    const end = recorder(name, details);
    if (!end) return noop;
    let ended = false;
    return (outcome = "complete") => {
      if (ended) return;
      ended = true;
      try {
        end(outcome);
      } catch {
        /* A diagnostic sink never owns application behavior. */
      }
    };
  } catch {
    return noop;
  }
}
export function measurePerformance<T>(name: string, operation: () => T, details?: SpanDetails): T {
  const end = startPerformanceSpan(name, details);
  try {
    const result = operation();
    end();
    return result;
  } catch (error) {
    end("failed");
    throw error;
  }
}
