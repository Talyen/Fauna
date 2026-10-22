import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/button";
const compactViewport = () => window.innerHeight <= 900;
function subscribeViewport(update: () => void) {
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}
/** One height breakpoint shared with the compact artwork tokens. */
export const useCompactLayout = () => useSyncExternalStore(subscribeViewport, compactViewport);

export function PageControls({
  page,
  pages,
  change,
  label = "Pages",
  showCount = true,
}: {
  page: number;
  pages: number;
  change: (page: number) => void;
  label?: string;
  showCount?: boolean;
}) {
  const nav = useRef<HTMLElement>(null);
  const restore = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!restore.current && !previousFocus.current?.matches(":disabled")) return;
    restore.current = false;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement) || focused.disabled || !nav.current?.contains(focused))
      nav.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [page, pages]);
  return (
    <nav
      className="pagination"
      aria-label={label}
      ref={nav}
      data-nav-row
      onFocusCapture={(event) => {
        previousFocus.current = event.target as HTMLElement;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) previousFocus.current = null;
      }}
    >
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
      {showCount ? (
        <span role="status" aria-live="polite">
          {page + 1} / {pages}
        </span>
      ) : null}
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
  adaptive,
  children,
  className,
  label,
  contentRole,
}: {
  items: readonly T[];
  pageSize: number;
  adaptive?: { columns: number; rows: number };
  children: (item: T, index: number) => ReactNode;
  className: string;
  label: string;
  contentRole?: "list";
}) {
  const [anchor, setAnchor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const [measuredCapacity, setMeasuredCapacity] = useState<number | null>(null);
  const capacity = Math.max(1, adaptive ? (measuredCapacity ?? pageSize) : pageSize);
  const tallestCell = useRef({ profile: "", height: 0 });
  const maxColumns = adaptive?.columns,
    maxRows = adaptive?.rows;
  useLayoutEffect(() => {
    const element = root.current;
    const grid = element?.firstElementChild as HTMLElement | null;
    const main = element?.closest("main");
    const stage = main?.closest(".screen-stage");
    if (!element || !grid || !main || !stage || !maxColumns || !maxRows) return;
    const measure = () => {
      const cells = Array.from(grid.children, (child) => child.getBoundingClientRect());
      const width = grid.getBoundingClientRect().width;
      const cellWidth = Math.max(...cells.map((cell) => cell.width));
      const cellHeight = Math.max(...cells.map((cell) => cell.height));
      if (!(width > 0 && cellWidth > 0 && cellHeight > 0)) return;
      const style = getComputedStyle(grid);
      const columnGap = Number.parseFloat(style.columnGap) || 0;
      const rowGap = Number.parseFloat(style.rowGap) || 0;
      const profile = `${cellWidth}:${style.fontSize}`;
      // Different pages can contain taller captions or rules. Retain their space so
      // returning to a shorter page cannot repeatedly grow and shrink capacity.
      tallestCell.current = {
        profile,
        height: Math.max(
          cellHeight,
          tallestCell.current.profile === profile ? tallestCell.current.height : 0,
        ),
      };
      // Subtract all surrounding content, including the reserved pagination slot.
      const available =
        stage.getBoundingClientRect().height -
        main.getBoundingClientRect().height +
        grid.getBoundingClientRect().height;
      const columns = Math.max(
        1,
        Math.min(maxColumns, Math.floor((width + columnGap) / (cellWidth + columnGap))),
      );
      const rows = Math.max(
        1,
        Math.min(maxRows, Math.floor((available + rowGap) / (tallestCell.current.height + rowGap))),
      );
      grid.style.setProperty(
        "--adaptive-page-height",
        `${rows * tallestCell.current.height + (rows - 1) * rowGap}px`,
      );
      setMeasuredCapacity(columns * rows);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const target of [stage, main, grid, ...grid.children]) observer.observe(target);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [maxColumns, maxRows, items, capacity]);
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const page = Math.min(Math.floor(anchor / capacity), pages - 1);
  const focusedItem = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const focused = focusedItem.current;
    if (focused && (!focused.isConnected || focused.matches(":disabled"))) {
      focusedItem.current = null;
      root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    }
  }, [items, page, capacity, pages]);
  return (
    <div
      className="paged-content"
      ref={root}
      onFocusCapture={(event) => {
        focusedItem.current = event.target as HTMLElement;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) focusedItem.current = null;
      }}
    >
      <div className={className} role={contentRole} data-adaptive={adaptive ? "true" : undefined}>
        {items
          .slice(page * capacity, (page + 1) * capacity)
          .map((item, index) => children(item, page * capacity + index))}
      </div>
      {pages > 1 ? (
        <PageControls page={page} pages={pages} change={(next) => setAnchor(next * capacity)} label={label} />
      ) : adaptive ? (
        <div className="pagination-spacer" aria-hidden="true" />
      ) : null}
    </div>
  );
}
