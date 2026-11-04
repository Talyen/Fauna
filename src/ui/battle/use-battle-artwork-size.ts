import { useLayoutEffect, type RefObject } from "react";
/** Fit the shared artwork baseline, keeping only 4px of middle-card clipping. */
export function useBattleArtworkSize(board: RefObject<HTMLElement | null>, handCount: number) {
  useLayoutEffect(() => {
    const root = board.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      if (!root.clientWidth || !root.clientHeight) return;
      const css = getComputedStyle(root);
      const paddingBottom = parseFloat(css.paddingBottom);
      const priorLift = parseFloat(css.getPropertyValue("--battle-hand-lift")) || 0;
      const hand = root.querySelector<HTMLElement>(".hand-section");
      const middle = [...root.querySelectorAll<HTMLElement>(".hand-slot")].sort(
        (a, b) =>
          Math.abs(parseFloat(a.style.getPropertyValue("--fan-offset"))) -
          Math.abs(parseFloat(b.style.getPropertyValue("--fan-offset"))),
      )[0];
      const middleCard = middle?.querySelector<HTMLElement>(".action-card");
      if (hand && middle && middleCard) {
        const cardCss = getComputedStyle(middleCard);
        const height = parseFloat(cardCss.height);
        const width = parseFloat(cardCss.width);
        const offset = Math.abs(parseFloat(middle.style.getPropertyValue("--fan-offset")) || 0);
        const angle = (offset * parseFloat(css.getPropertyValue("--hand-fan-angle-step")) * Math.PI) / 180;
        const rotatedHeight = height * Math.cos(angle) + width * Math.sin(angle);
        const drop =
          parseFloat(css.getPropertyValue("--hand-fan-rest-drop")) +
          offset * parseFloat(css.getPropertyValue("--hand-fan-drop-step"));
        // Recover the unlifted rest pose; hover/selection transforms must not move the fan.
        const lift = Math.max(
          0,
          Math.ceil(
            hand.getBoundingClientRect().bottom +
              priorLift +
              drop +
              (rotatedHeight - height) / 2 -
              window.innerHeight -
              4,
          ),
        );
        if (Number.isFinite(lift) && lift !== priorLift)
          root.style.setProperty("--battle-hand-lift", `${lift}px`);
      }
      const rows = [...root.querySelectorAll<HTMLElement>(".enemy-row, .player-row")];
      const sample = root.querySelector<HTMLElement>(".creature-card");
      const rail = root.querySelector<HTMLElement>(".target-control");
      if (!sample || !rail || rows.length !== 2) return;
      const gap = parseFloat(css.rowGap);
      const rowCss = getComputedStyle(rows[0]!);
      const columnGap = parseFloat(rowCss.columnGap);
      const rowPadding = parseFloat(rowCss.paddingLeft) + parseFloat(rowCss.paddingRight);
      // offsetHeight rounds fractional artwork sizes, feeding a one-pixel
      // oscillation back through ResizeObserver at height-constrained viewports.
      const sampleHeight = parseFloat(getComputedStyle(sample).height) || sample.offsetHeight;
      const extra = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height - sampleHeight, 0);
      const handTop = hand
        ? hand.getBoundingClientRect().top +
          (parseFloat(root.style.getPropertyValue("--battle-hand-lift")) || 0)
        : root.getBoundingClientRect().bottom;
      const clearance = parseFloat(css.getPropertyValue("--battle-hand-hover-clearance"));
      const handHeight = hand ? parseFloat(getComputedStyle(hand).height) : 0;
      const availableHeight =
        Math.min(
          root.clientHeight - paddingBottom + priorLift,
          handTop - root.getBoundingClientRect().top - clearance,
        ) + handHeight;
      // Each rail keeps enough room for target rules and the symmetric controls beside the board.
      const minimumRail = parseFloat(getComputedStyle(rail).minWidth);
      const byWidth = (root.clientWidth - 2 * minimumRail - 2 * columnGap - rowPadding - 2 * gap) / 3;
      // Two landscape rows use 3/4 of the base long side each; the portrait hand uses one.
      // Fit the combined artwork budget directly so the hand cannot feed shrinking sizes back in.
      // The combatants' 10% enlargement uses part of the existing 10% fitting clearance.
      const byHeight = (availableHeight - extra - gap) / 2.5;
      const width = Math.max(
        parseFloat(css.getPropertyValue("--control-height")),
        Math.floor(Math.min(byWidth, byHeight)) * 0.9,
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
  }, [board, handCount]);
}
