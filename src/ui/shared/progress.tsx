import { Progress as ShadcnProgress } from "../../components/ui/progress";
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
    ref.current?.style.setProperty(
      "--previous",
      `${Math.max(0, Math.min(100, ((previous ?? value) / maximum) * 100))}%`,
    );
  }, [value, maximum, previous]);
  return (
    <ShadcnProgress
      ref={ref}
      className="progress-track"
      aria-label={label}
      value={value}
      max={maximum}
      data-combat-tone={tone}
      data-forecast={previous !== undefined || undefined}
      data-direction={previous === undefined ? undefined : value < previous ? "loss" : "gain"}
    >
      <span className="progress-previous" />
    </ShadcnProgress>
  );
}
