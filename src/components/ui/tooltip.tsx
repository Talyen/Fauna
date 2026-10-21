// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/tooltip.json
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useSurfaceRef } from "../../lib/surface-ref";
import { cn } from "@/lib/utils";

export function TooltipProvider(props: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0} disableHoverableContent {...props} />
  );
}

const TooltipInteraction = React.createContext<
  { changeOpen: (open: boolean) => void; open: boolean } | undefined
>(undefined);

export function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const changeOpen = React.useCallback(
    (next: boolean) => {
      setLocalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  React.useEffect(() => {
    if (!open) return;
    const dismiss = () => changeOpen(false);
    const onVisibilityChange = () => {
      if (document.hidden) dismiss();
    };
    window.addEventListener("blur", dismiss);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", dismiss);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [open, changeOpen]);
  return (
    <TooltipPrimitive.Root {...props} open={open} onOpenChange={changeOpen}>
      <TooltipInteraction.Provider value={{ changeOpen, open }}>{children}</TooltipInteraction.Provider>
    </TooltipPrimitive.Root>
  );
}

export const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger> & { reopenOnPointerMove?: boolean }
>(({ onFocus, onPointerMove, reopenOnPointerMove = true, ...props }, ref) => {
  const interaction = React.useContext(TooltipInteraction);
  return (
    <TooltipPrimitive.Trigger
      {...props}
      ref={ref}
      onFocus={(event) => {
        onFocus?.(event);
        if (document.documentElement.dataset.focus !== "visible") event.preventDefault();
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        // A fresh mouse move restores details dismissed by selecting the same card.
        if (
          reopenOnPointerMove &&
          !event.defaultPrevented &&
          event.pointerType === "mouse" &&
          event.buttons === 0
        )
          interaction?.changeOpen(true);
      }}
    />
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => {
  const surface = useSurfaceRef(ref);
  const interaction = React.useContext(TooltipInteraction);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side="top"
        ref={surface}
        sideOffset={sideOffset}
        collisionPadding={16}
        aria-hidden={interaction?.open === false || undefined}
        className={cn(
          "game-tooltip z-50 border border-border bg-popover text-left text-base text-popover-foreground",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";
