import { useCallback, type Ref } from "react";

/** Measure the untransformed border box so hover scaling cannot change corner geometry. */
export function useSurfaceRef<T extends HTMLElement>(forwardedRef?: Ref<T>) {
  return useCallback(
    (node: T | null) => {
      if (!node) return;
      const release = typeof forwardedRef === "function" ? forwardedRef(node) : undefined;
      if (forwardedRef && typeof forwardedRef !== "function") forwardedRef.current = node;
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
        else if (typeof forwardedRef === "function") forwardedRef(null);
        else if (forwardedRef) forwardedRef.current = null;
      };
    },
    [forwardedRef],
  );
}
