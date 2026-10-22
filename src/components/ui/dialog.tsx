// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/dialog.json
import * as React from "react";
import { useSurfaceRef } from "../../ui/infrastructure/surface-ref";
import { useModalSurfaceRef } from "../../ui/infrastructure/modal-surface-ref";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-xl font-semibold", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-base text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    closeLabel?: string;
    showCloseButton?: boolean;
  }
>(({ className, children, closeLabel = "Close inspection", showCloseButton = true, ...props }, ref) => {
  const surface = useSurfaceRef(useModalSurfaceRef(ref));
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content ref={surface} className={cn("dialog-content", className)} {...props}>
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="dialog-close absolute right-2 top-2"
              aria-label={closeLabel}
            >
              <X aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";
