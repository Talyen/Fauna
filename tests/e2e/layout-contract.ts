import { expect, type Page } from "@playwright/test";

/** Also runs against deliberate failures: clipping must not masquerade as fitting. */
export function layoutViolations() {
  const failures: string[] = [];
  const describe = (el: Element) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${typeof el.className === "string" ? el.className.trim().replace(/\s+/g, ".") : ""}`;
  const invisible = (el: Element) => {
    const css = getComputedStyle(el);
    for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement)
      if (getComputedStyle(ancestor).opacity === "0") return true;
    return (
      !el.getClientRects().length ||
      css.visibility === "hidden" ||
      css.display === "none" ||
      !!el.closest("[hidden], [inert], .sr-only") ||
      css.clip === "rect(0px, 0px, 0px, 0px)" ||
      css.clipPath === "inset(50%)"
    );
  };
  const documentRoot = document.documentElement;
  if (documentRoot.scrollWidth > innerWidth + 1 || documentRoot.scrollHeight > innerHeight + 1)
    failures.push("document overflows the viewport");
  const dialogs = [
    ...document.querySelectorAll(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ),
  ];
  const active = dialogs.at(-1) ?? document.querySelector(".app:not([inert])") ?? document.body;
  const roots = [active, ...document.querySelectorAll('.game-tooltip:not([data-state="closed"])')];
  const elements = new Set(roots.flatMap((root) => [root, ...root.querySelectorAll("*")]));
  for (const el of elements) {
    if (!(el instanceof HTMLElement) || invisible(el)) continue;
    // Only the authored hand fan may overlap and cross the bottom edge.
    if (el.closest(".hand-section")) continue;
    const css = getComputedStyle(el);
    const name = describe(el);
    if (/^(auto|scroll)$/.test(css.overflowX) || /^(auto|scroll)$/.test(css.overflowY))
      failures.push(`${name} is a scroll area`);
    // Visible overflow can intentionally extend into a containing layout's reserved space
    // (for example external combat effects). Bounds below still check every visible child.
    const clipsX =
      /^(hidden|clip)$/.test(css.overflowX) ||
      el.matches("button:not(.creature-card):not(.action-card), p, dt, dd, h1, h2, h3");
    const clipsY =
      /^(hidden|clip)$/.test(css.overflowY) ||
      el.matches("button:not(.creature-card):not(.action-card), p, dt, dd, h1, h2, h3");
    if (
      el.clientWidth &&
      ((clipsX && el.scrollWidth > el.clientWidth + 1) || (clipsY && el.scrollHeight > el.clientHeight + 1))
    )
      failures.push(`${name} has overflowing or clipped content`);
    const box = el.getBoundingClientRect();
    if (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1)
      failures.push(`${name} is outside the viewport`);
    if (el.matches('button:not(:disabled), [role="switch"], [role="radio"], [role="slider"], [role="tab"]')) {
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      if (!hit || !el.contains(hit)) failures.push(`${name} is obscured`);
      if ((el.closest("label, .ui-slider") ?? el).getBoundingClientRect().height < 43.5)
        failures.push(`${name} has a hit area shorter than 44px`);
    }
  }
  return [...new Set(failures)];
}

export async function expectScrollFree(page: Page) {
  await expect
    .poll(() => page.evaluate(layoutViolations), {
      message: "Player UI must fit without scrolling or clipping",
    })
    .toEqual([]);
}
