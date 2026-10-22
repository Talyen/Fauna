import { useLayoutEffect, type RefObject } from "react";
/** Fit both rows against their real readouts and the enlarged hand, without scaling text. */
export function useBattleArtworkSize(board: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = board.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      if (!root.clientWidth || !root.clientHeight) return;
      const css = getComputedStyle(root);
      const rows = [...root.querySelectorAll<HTMLElement>(".enemy-row, .player-row")];
      const sample = root.querySelector<HTMLElement>(".creature-card");
      const rail = root.querySelector<HTMLElement>(".target-control");
      if (!sample || !rail || rows.length !== 2) return;
      const gap = parseFloat(css.rowGap);
      const rowCss = getComputedStyle(rows[0]!);
      const columnGap = parseFloat(rowCss.columnGap);
      const rowPadding = parseFloat(rowCss.paddingLeft) + parseFloat(rowCss.paddingRight);
      const extra = rows.reduce(
        (sum, row) => sum + row.getBoundingClientRect().height - sample.offsetHeight,
        0,
      );
      const hand = root.querySelector<HTMLElement>(".hand-section");
      const handTop = hand?.getBoundingClientRect().top ?? root.getBoundingClientRect().bottom;
      const clearance = parseFloat(css.getPropertyValue("--battle-hand-hover-clearance"));
      const availableHeight = Math.min(
        root.clientHeight - parseFloat(css.paddingBottom),
        handTop - root.getBoundingClientRect().top - clearance,
      );
      // Each rail keeps enough room for target rules and the symmetric controls beside the board.
      const minimumRail = parseFloat(getComputedStyle(rail).minWidth);
      const byWidth = (root.clientWidth - 2 * minimumRail - 2 * columnGap - rowPadding - 2 * gap) / 3;
      const byHeight = ((availableHeight - extra - gap) * 2) / 3;
      const width = Math.max(
        parseFloat(css.getPropertyValue("--control-height")),
        Math.floor(Math.min(byWidth, byHeight)),
      );
      if (root.style.getPropertyValue("--battle-fitted-width") !== `${width}px`)
        root.style.setProperty("--battle-fitted-width", `${width}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    for (const node of root.querySelectorAll(".enemy-row, .player-row, .hand-section, .combatant-details"))
      observer.observe(node);
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [board]);
}
