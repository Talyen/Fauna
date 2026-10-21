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
  return (
    <Button variant="ghost" className="mana" aria-label={`Mana ${mana} of ${maximum}`}>
      {Array.from({ length: maximum }, (_, index) => (
        <span
          className="mana-gem"
          key={index}
          data-filled={index < mana}
          data-preview-spent={index < mana && index >= mana - previewCost}
          aria-hidden="true"
        >
          <span className="mana-socket" />
          <span className="mana-empty" />
          <span className="mana-full" />
          <span className="mana-glint" />
        </span>
      ))}
    </Button>
  );
}
