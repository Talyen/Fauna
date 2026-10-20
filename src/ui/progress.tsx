import { useLayoutEffect, useRef } from "react";
export function Progress({
  value,
  maximum,
  label,
  previous,
  tone,
}: {
  value: number;
  maximum: number;
  label: string;
  previous?: number;
  tone?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.style.setProperty("--progress", `${Math.max(0, Math.min(100, (value / maximum) * 100))}%`);
    ref.current?.style.setProperty(
      "--previous",
      `${Math.max(0, Math.min(100, ((previous ?? value) / maximum) * 100))}%`,
    );
  }, [value, maximum, previous]);
  return (
    <div
      ref={ref}
      className="progress-track"
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={maximum}
      data-combat-tone={tone}
    >
      <span className="progress-previous" />
      <span className="progress-current" />
    </div>
  );
}
