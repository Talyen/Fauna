import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";

/** One height breakpoint shared with the compact artwork tokens. */
export function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.innerHeight <= 900);
  useLayoutEffect(() => {
    const update = () => setCompact(window.innerHeight <= 900);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return compact;
}

export function PageControls({
  page,
  pages,
  change,
  label = "Pages",
}: {
  page: number;
  pages: number;
  change: (page: number) => void;
  label?: string;
}) {
  const nav = useRef<HTMLElement>(null);
  const restore = useRef(false);
  useLayoutEffect(() => {
    if (!restore.current) return;
    restore.current = false;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement) || focused.disabled || !nav.current?.contains(focused))
      nav.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [page, pages]);
  return (
    <nav className="pagination" aria-label={label} ref={nav} data-nav-row>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => {
          restore.current = true;
          change(page - 1);
        }}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span role="status" aria-live="polite">
        {page + 1} / {pages}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next page"
        disabled={page >= pages - 1}
        onClick={() => {
          restore.current = true;
          change(page + 1);
        }}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

/** Keep the first visible item on its page when capacity changes on resize. */
export function PagedItems<T>({
  items,
  pageSize,
  children,
  className,
  label,
  contentRole,
}: {
  items: readonly T[];
  pageSize: number;
  children: (item: T, index: number) => ReactNode;
  className: string;
  label: string;
  contentRole?: "list";
}) {
  const [anchor, setAnchor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const capacity = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const page = Math.min(Math.floor(anchor / capacity), pages - 1);
  const focusedItem = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const focused = focusedItem.current;
    if (focused && (!focused.isConnected || focused.matches(":disabled"))) {
      root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
      focusedItem.current = null;
    }
  }, [items, page, capacity, pages]);
  return (
    <div
      className="paged-content"
      ref={root}
      onFocusCapture={(event) => {
        focusedItem.current = event.target as HTMLElement;
      }}
    >
      <div className={className} role={contentRole}>
        {items
          .slice(page * capacity, (page + 1) * capacity)
          .map((item, index) => children(item, page * capacity + index))}
      </div>
      {pages > 1 ? (
        <PageControls page={page} pages={pages} change={(next) => setAnchor(next * capacity)} label={label} />
      ) : null}
    </div>
  );
}
