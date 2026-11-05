import { useMessages } from "../localization/message-context";
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  startTransition,
  useDeferredValue,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ArtworkContext, useArtwork, useUpcomingArtwork } from "../artwork";
const compactViewport = () => window.innerHeight <= 900;
function subscribeViewport(update: () => void) {
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}
/** One height breakpoint shared with the compact artwork tokens. */
export const useCompactLayout = () =>
  useDeferredValue(useSyncExternalStore(subscribeViewport, compactViewport));

/** Anchors belong to a view/filter and survive resize without reviving invalid pages. */
export function usePagination(
  count: number,
  pageSize: number,
  group = "default",
  artwork?: (start: number, end: number) => readonly string[],
) {
  const cache = useContext(ArtworkContext);
  const capacity = Math.max(1, pageSize);
  const [anchors, setAnchors] = useState<Record<string, number>>({});
  const anchor = anchors[group] ?? 0;
  const pages = Math.max(1, Math.ceil(count / capacity));
  const page = Math.min(Math.floor(anchor / capacity), pages - 1);
  const change = (next: number) => {
    const start = Math.max(0, Math.min(next, pages - 1)) * capacity;
    const update = () =>
      setAnchors((current) => ({
        ...current,
        [group]: start,
      }));
    if (!cache || !artwork || cache.canAcquire(artwork(start, start + capacity))) update();
    else startTransition(update);
  };
  if (anchor >= count && anchor !== 0) setAnchors((current) => ({ ...current, [group]: page * capacity }));
  return { page, pages, start: page * capacity, change };
}

function fittedColumns(width: number, cellWidth: number, gap: number, maximum: number) {
  return Math.max(1, Math.min(maximum, Math.floor((width + gap) / (cellWidth + gap))));
}

/** Fixed-row galleries share width measurement; PagedItems additionally measures row height. */
export function useGridColumns(gridRef: RefObject<HTMLDivElement | null>, maximum: number, group: string) {
  const [measurement, setMeasurement] = useState({ group, columns: maximum });
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const width = grid.getBoundingClientRect().width;
      const cellWidth = grid.firstElementChild?.getBoundingClientRect().width ?? 0;
      if (!(width > 0 && cellWidth > 0)) return;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      const columns = fittedColumns(width, cellWidth, gap, maximum);
      startTransition(() =>
        setMeasurement((current) =>
          current.group === group && current.columns === columns ? current : { group, columns },
        ),
      );
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
  return measurement.group === group ? measurement.columns : maximum;
}

export function PageControls({
  page,
  pages,
  change,
  label,
}: {
  page: number;
  pages: number;
  change: (page: number) => void;
  label?: string;
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
      data-page={page}
      onFocusCapture={(event) => {
        previousFocus.current = event.target as HTMLElement;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) previousFocus.current = null;
      }}
    >
      <Button
        variant="outline"
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
      <Button
        variant="outline"
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
  artwork,
}: {
  items: readonly T[];
  pageSize: number;
  adaptive?: { columns: number; rows: number };
  children: (item: T, index: number) => ReactNode;
  className: string;
  label: string;
  contentRole?: "list";
  artwork?: (item: T) => string;
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
      startTransition(() => setMeasuredCapacity(columns * rows));
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
  const { page, pages, change } = usePagination(
    items.length,
    capacity,
    "default",
    artwork ? (start, end) => items.slice(start, end).map(artwork) : undefined,
  );
  const visible = items.slice(page * capacity, (page + 1) * capacity);
  useArtwork(artwork ? visible.map(artwork) : []);
  useUpcomingArtwork(
    artwork ? items.slice(Math.max(0, (page - 1) * capacity), (page + 2) * capacity).map(artwork) : [],
  );
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
        {visible.map((item, index) => children(item, page * capacity + index))}
      </div>
      {pages > 1 ? (
        <PageControls page={page} pages={pages} change={change} label={label} />
      ) : adaptive ? (
        <div className="pagination-spacer" aria-hidden="true" />
      ) : null}
    </div>
  );
}
