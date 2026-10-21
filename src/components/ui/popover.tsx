// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/popover.json
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { useSurfaceRef } from "../../lib/surface-ref";
import { useModalSurfaceRef } from "../../lib/modal-surface-ref";

export const Popover = PopoverPrimitive.Root;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "end", sideOffset = 8, collisionPadding = 16, ...props }, ref) => {
  const surface = useSurfaceRef(useModalSurfaceRef(ref));
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={surface}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn("popover-content", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";
