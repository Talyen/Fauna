import { useCallback, useEffect, useRef, type ForwardedRef } from "react";
/** Radix retains closing content for CSS exit animation. Retained pixels cannot own input. */
export function useModalSurfaceRef(forwardedRef: ForwardedRef<HTMLDivElement>) {
  const observer = useRef<MutationObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
      if (!node) return;
      let closed = false,
        hidden: string | null = null,
        inert = false;
      const sync = () => {
        if (node.dataset.state === "closed" && !closed) {
          closed = true;
          hidden = node.getAttribute("aria-hidden");
          inert = node.inert;
          node.inert = true;
          node.setAttribute("inert", "");
          node.setAttribute("aria-hidden", "true");
        } else if (node.dataset.state !== "closed" && closed) {
          closed = false;
          node.inert = inert;
          if (!inert) node.removeAttribute("inert");
          if (hidden === null) node.removeAttribute("aria-hidden");
          else node.setAttribute("aria-hidden", hidden);
        }
      };
      sync();
      observer.current = new MutationObserver(sync);
      observer.current.observe(node, { attributes: true, attributeFilter: ["data-state"] });
    },
    [forwardedRef],
  );
}
