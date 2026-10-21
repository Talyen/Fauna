import { useState } from "react";
import { Button } from "../components/ui/button";

/** Adapted from Alchemy's ManaPanel: independent full/spent art and masked hover glints. */
export function ManaCrystals({
  mana,
  maximum = 4,
  previewCost = 0,
}: {
  mana: number;
  maximum?: number;
  previewCost?: number;
}) {
  const [glints, setGlints] = useState<number[]>([]);
  const glint = (index: number) =>
    setGlints((previous) => {
      const next = [...previous];
      next[index] = (next[index] ?? 0) + 1;
      return next;
    });
  return (
    <Button
      variant="ghost"
      className="mana"
      aria-label={`Mana ${mana} of ${maximum}`}
      onFocus={() => {
        if (document.documentElement.dataset.focus === "visible")
          setGlints((previous) => Array.from({ length: maximum }, (_, index) => (previous[index] ?? 0) + 1));
      }}
    >
      {Array.from({ length: maximum }, (_, index) => (
        <span
          className="mana-gem"
          key={index}
          data-filled={index < mana}
          data-preview-spent={index < mana && index >= mana - previewCost}
          onPointerEnter={() => glint(index)}
          aria-hidden="true"
        >
          <span className="mana-socket" />
          <span className="mana-empty" />
          <span className="mana-full" />
          <span key={glints[index] ?? 0} className="mana-glint" data-glint={Boolean(glints[index])} />
        </span>
      ))}
    </Button>
  );
}
