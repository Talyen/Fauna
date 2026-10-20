import { Button } from "../components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";

/** Adapted from Alchemy's ManaPanel: independent full/spent art and masked hover glints. */
export function ManaCrystals({
  mana,
  maximum = 3,
  previewCost = 0,
}: {
  mana: number;
  maximum?: number;
  previewCost?: number;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>
        <strong>
          Mana {mana}/{maximum}
        </strong>
        <p>Refills at the start of your turn.</p>
      </TooltipContent>
    </Tooltip>
  );
}
