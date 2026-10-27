import { Fragment, type ReactNode } from "react";

/** Interpolate rich values after the reader validates the complete translated message. */
export function MessageParts({
  template,
  values,
}: {
  template: string;
  values: Readonly<Record<string, ReactNode>>;
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  const occurrences = new Map<string, number>();
  for (const match of template.matchAll(/\{\{([a-zA-Z][\w]*)\}\}/g)) {
    const name = match[1]!;
    const occurrence = occurrences.get(name) ?? 0;
    occurrences.set(name, occurrence + 1);
    parts.push(template.slice(cursor, match.index));
    parts.push(
      <Fragment key={`${name}:${occurrence}`}>
        {Object.hasOwn(values, name) ? values[name] : match[0]}
      </Fragment>,
    );
    cursor = match.index + match[0].length;
  }
  parts.push(template.slice(cursor));
  return parts;
}
