// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/slider.json
"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(
  (
    { className, "aria-label": label, "aria-labelledby": labelledBy, "aria-valuetext": valueText, ...props },
    ref,
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex min-h-[var(--control-height)] w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-valuetext={valueText}
        className="flex h-[var(--control-height)] w-[var(--control-height)] items-center justify-center rounded-full after:h-[var(--space-5)] after:w-[var(--space-5)] after:rounded-full after:border after:border-primary after:bg-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
