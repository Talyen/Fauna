import type { ComponentPropsWithRef } from "react";

/** The stage owns available space; the main owns the bounded content composition. */
export function Screen(props: ComponentPropsWithRef<"main">) {
  return (
    <div className="screen-stage">
      <main {...props} />
    </div>
  );
}
