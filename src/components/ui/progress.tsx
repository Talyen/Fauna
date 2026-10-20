// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/progress.json
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, children, ...props }, ref) => {
  const indicator = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const percent = Math.max(0, Math.min(100, ((value ?? 0) / max) * 100));
    indicator.current?.style.setProperty("transform", `translateX(-${100 - percent}%)`);
  }, [value, max]);
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={value}
      max={max}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      {children}
      <ProgressPrimitive.Indicator
        ref={indicator}
        className="progress-current h-full w-full flex-1 bg-primary transition-all"
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;
export { Progress };
