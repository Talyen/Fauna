// Adapted from shadcn/ui (MIT): https://ui.shadcn.com/r/styles/new-york/button.json
import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { useSurfaceRef } from "../../ui/infrastructure/surface-ref";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "game-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "control-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "control-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "control-outline border border-input bg-secondary hover:bg-accent hover:text-accent-foreground",
        secondary: "control-outline bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "control-outline border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        art: "relative bg-transparent p-0 whitespace-normal text-left font-normal shadow-none",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--control-height)] px-4 py-2",
        sm: "h-[var(--control-height)] rounded-lg px-3 text-sm",
        lg: "h-11 rounded-lg px-8",
        icon: "control-icon h-[var(--control-height)] w-[var(--control-height)] p-0",
        card: "h-auto p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  busy?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      busy = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const surface = useSurfaceRef(ref);
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={surface}
        type={type}
        disabled={disabled || busy}
        {...props}
        aria-busy={busy || props["aria-busy"]}
      >
        {busy && !asChild ? (
          <>
            <LoaderCircle className="ui-spinner" aria-hidden="true" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
