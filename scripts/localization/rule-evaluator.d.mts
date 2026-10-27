export function evaluateRule(
  node: unknown,
  values: Record<string, unknown>,
  functions: Record<string, (...args: never[]) => unknown>,
): unknown;
export function describeRule(
  fn: unknown,
  args: unknown[],
  functions: Record<string, (...args: never[]) => unknown>,
): unknown;
