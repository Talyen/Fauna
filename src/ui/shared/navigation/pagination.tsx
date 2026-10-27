import { useMessages } from "../localization/message-context";
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/button";
const compactViewport = () => window.innerHeight <= 900;
function subscribeViewport(update: () => void) {
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}
/** One height breakpoint shared with the compact artwork tokens. */
export const useCompactLayout = () => useSyncExternalStore(subscribeViewport, compactViewport);

/** Anchors belong to a view/filter and survive resize without reviving invalid pages. */
export function usePagination(count: number, pageSize: number, group = "default") {
  const capacity = Math.max(1, pageSize);
  const [anchors, setAnchors] = useState<Record<string, number>>({});
  const anchor = anchors[group] ?? 0;
  const pages = Math.max(1, Math.ceil(count / capacity));
  const page = Math.min(Math.floor(anchor / capacity), pages - 1);
  const change = (next: number) =>
    setAnchors((current) => ({
      ...current,
      [group]: Math.max(0, Math.min(next, pages - 1)) * capacity,
    }));
  if (anchor >= count && anchor !== 0) change(page);
  return { page, pages, start: page * capacity, change };
}

function fittedColumns(width: number, cellWidth: number, gap: number, maximum: number) {
  return Math.max(1, Math.min(maximum, Math.floor((width + gap) / (cellWidth + gap))));
}

/** Fixed-row galleries share width measurement; PagedItems additionally measures row height. */
export function useGridColumns(gridRef: RefObject<HTMLDivElement | null>, maximum: number, group: string) {
  const [columns, setColumns] = useState(maximum);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const width = grid.getBoundingClientRect().width;
      const cellWidth = grid.firstElementChild?.getBoundingClientRect().width ?? 0;
      if (!(width > 0 && cellWidth > 0)) return;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      setColumns(fittedColumns(width, cellWidth, gap, maximum));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    if (grid.firstElementChild) observer.observe(grid.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [gridRef, maximum, group]);
  return columns;
}

export function PageControls({
  page,
  pages,
  change,
  label,
  showCount = true,
}: {
  page: number;
  pages: number;
  change: (page: number) => void;
  label?: string;
  showCount?: boolean;
}) {
  const i18n = useMessages();
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
      aria-label={label ?? i18n.message("pagination.pages", "Pages")}
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
        aria-label={i18n.message("pagination.previous", "Previous page")}
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
        aria-label={i18n.message("pagination.next", "Next page")}
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
      const columns = fittedColumns(width, cellWidth, columnGap, maxColumns);
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
  const { page, pages, change } = usePagination(items.length, capacity);
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
        <PageControls page={page} pages={pages} change={change} label={label} />
      ) : adaptive ? (
        <div className="pagination-spacer" aria-hidden="true" />
      ) : null}
    </div>
  );
}
