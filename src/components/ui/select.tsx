// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/select.json
import { type ComponentProps } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger>;

function SelectTrigger({ className, children, ref, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border border-border/80 bg-background px-4 py-3 text-base text-foreground transition-colors outline-none focus:border-primary data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

type SelectContentProps = ComponentProps<typeof SelectPrimitive.Content>;

function SelectContent({
  className,
  children,
  position = "popper",
  collisionPadding = 16,
  ref,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-radix-select-content
        data-state="open"
        ref={ref}
        className={cn(
          "relative z-50 max-h-[min(calc(24*var(--content-rem,1rem)),var(--radix-select-content-available-height))] min-w-[calc(8*var(--content-rem,1rem))] overflow-hidden rounded-xl border border-border/80 bg-background text-popover-foreground shadow-md",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        collisionPadding={collisionPadding}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "min-h-0 p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

type SelectItemProps = ComponentProps<typeof SelectPrimitive.Item>;

function SelectItem({ className, children, ref, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex min-h-[var(--control-height)] w-full cursor-default items-center rounded-xl py-2.5 pr-4 pl-10 text-sm text-foreground transition-colors outline-none select-none focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted/80",
        className,
      )}
      {...props}
    >
      <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
