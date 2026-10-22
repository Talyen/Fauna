import { useCallback, type Ref } from "react";

/** Measure the untransformed border box so hover scaling cannot change corner geometry. */
export function useSurfaceRef<T extends HTMLElement>(forwarded?: Ref<T>) {
  return useCallback(
    (node: T | null) => {
      if (!node) return;
      const release = typeof forwarded === "function" ? forwarded(node) : undefined;
      if (forwarded && typeof forwarded !== "function") forwarded.current = node;
      let active = true;
      const update = (width: number, height: number) => {
        if (active && width > 0 && height > 0)
          node.style.setProperty("--surface-short-side", `${Math.min(width, height)}px`);
      };
      update(node.offsetWidth, node.offsetHeight);
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver((entries) => {
              const size = entries[0]?.borderBoxSize[0];
              if (size) update(size.inlineSize, size.blockSize);
            });
      observer?.observe(node, { box: "border-box" });
      return () => {
        active = false;
        observer?.disconnect();
        node.style.removeProperty("--surface-short-side");
        if (typeof release === "function") release();
        else if (typeof forwarded === "function") forwarded(null);
        else if (forwarded) forwarded.current = null;
      };
    },
    [forwarded],
  );
}
