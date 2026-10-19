import { Button } from "../../src/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../src/components/ui/tooltip";

/** Adapted from Alchemy's ManaPanel: independent full/spent art and masked hover glints. */
export function ManaCrystals({ mana, maximum = 3 }: { mana: number; maximum?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" className="sample-mana" aria-label={`Mana ${mana} of ${maximum}`}>
          {Array.from({ length: maximum }, (_, index) => (
            <span className="sample-mana-gem" key={index} data-filled={index < mana} aria-hidden="true">
              <span className="sample-mana-socket" />
              <img src="/ui/mana/empty.webp" className="sample-mana-empty" alt="" draggable={false} />
              <img src="/ui/mana/full.webp" className="sample-mana-full" alt="" draggable={false} />
              <span className="sample-mana-glint" />
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
