import { expect, type Page } from "@playwright/test";

export const REVIEW_VIEWPORTS = [
  [1280, 720],
  [1280, 800],
  [1920, 1080],
  [2560, 1080],
  [3440, 1440],
] as const;

// Exercise both text sizes at the tightest viewport, then each remaining layout
// profile/aspect ratio once. Behavior tests do not need this entire matrix.
export const LAYOUT_CASES = [
  [1280, 720, 1],
  [1280, 720, 1.25],
  [1280, 800, 1.25],
  [1920, 1080, 1],
  [2560, 1080, 1.25],
  [3440, 1440, 1],
] as const;

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
  const roots = [
    active,
    ...document.querySelectorAll('.game-tooltip:not([data-state="closed"]), .combat-feedback'),
  ];
  // Measure the content group, not a full-height wrapper that could hide top alignment.
  for (const main of active.querySelectorAll(".screen-stage > main")) {
    if (!(main instanceof HTMLElement) || invisible(main)) continue;
    const stage = main.parentElement!.getBoundingClientRect();
    const box = main.getBoundingClientRect();
    const css = getComputedStyle(main);
    if (Math.abs(box.left + box.width / 2 - (stage.left + stage.width / 2)) > 1)
      failures.push(`${describe(main)} is not horizontally centered`);
    const content = [...main.children].filter((child) => {
      const position = getComputedStyle(child).position;
      return !invisible(child) && position !== "absolute" && position !== "fixed";
    });
    if (!content.length) continue;
    const boxes = content.map((child) => child.getBoundingClientRect());
    const center =
      (Math.min(...boxes.map((rect) => rect.top)) + Math.max(...boxes.map((rect) => rect.bottom))) / 2;
    // The fixed hand owns the bottom strip; the battlefield centers above it.
    const reserved = main.matches(".battle-screen") ? parseFloat(css.paddingBottom) : 0;
    if (Math.abs(center - (stage.top + (stage.height - reserved) / 2)) > 1)
      failures.push(`${describe(main)} content is not vertically centered`);
  }
  if (dialogs.length && active.matches(".menu-panel")) {
    const anchor = document.querySelector(".play-surface button[data-menu-anchor]");
    const box = active.getBoundingClientRect();
    if (!anchor) failures.push("menu has no anchor");
    else {
      const expectedRight = Math.min(
        innerWidth - 16,
        Math.max(anchor.getBoundingClientRect().right, 16 + box.width),
      );
      if (Math.abs(box.right - expectedRight) > 1) failures.push("menu is not aligned with its opener");
    }
  } else if (dialogs.length) {
    const box = active.getBoundingClientRect();
    if (
      Math.abs(box.left + box.width / 2 - innerWidth / 2) > 1 ||
      Math.abs(box.top + box.height / 2 - innerHeight / 2) > 1
    )
      failures.push("dialog is not centered in the viewport");
  }
  const elements = new Set(roots.flatMap((root) => [root, ...root.querySelectorAll("*")]));
  const scrollRegion = (el: Element | null): el is HTMLElement =>
    el instanceof HTMLElement &&
    el.hasAttribute("data-scroll-region") &&
    !!el.closest(".glossary-screen, .settings-screen, .help-dialog") &&
    el.getAttribute("role") === "region" &&
    el.tabIndex === 0 &&
    !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"));
  for (const el of elements) {
    if (!(el instanceof HTMLElement) || invisible(el)) continue;
    // Only the authored hand fan may overlap and cross the bottom edge.
    if (el.closest(".hand-section")) continue;
    const css = getComputedStyle(el);
    const name = describe(el);
    const scrolling = /^(auto|scroll)$/.test(css.overflowX) || /^(auto|scroll)$/.test(css.overflowY);
    if (scrolling && !scrollRegion(el)) failures.push(`${name} is a scroll area`);
    if (scrollRegion(el) && el.scrollWidth > el.clientWidth + 1)
      failures.push(`${name} scrolls horizontally`);
    const ancestor = el.parentElement?.closest("[data-scroll-region]") ?? null;
    const region = scrollRegion(ancestor) ? ancestor.getBoundingClientRect() : null;
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
    // Radix Progress translates a full-width fill behind its bounded track mask.
    const progressFill = el.matches(
      ".progress-track > .progress-current, .progress-track > .progress-previous",
    );
    if (
      !progressFill &&
      (box.left < -1 ||
        box.right > innerWidth + 1 ||
        (!region && (box.top < -1 || box.bottom > innerHeight + 1)))
    )
      failures.push(`${name} is outside the viewport`);
    if (el.matches('button:not(:disabled), [role="switch"], [role="radio"], [role="slider"], [role="tab"]')) {
      const middleX = box.x + box.width / 2,
        middleY = box.y + box.height / 2;
      const insetX = Math.min(12, box.width / 4),
        insetY = Math.min(12, box.height / 4);
      const points = [
        [middleX, middleY],
        [box.left + insetX, middleY],
        [box.right - insetX, middleY],
        [middleX, box.top + insetY],
        [middleX, box.bottom - insetY],
      ];
      if (
        points
          .filter(
            ([x, y]) =>
              !region || (x! >= region.left && x! <= region.right && y! >= region.top && y! <= region.bottom),
          )
          .some(([x, y]) => {
            const hit = document.elementFromPoint(x!, y!);
            return !hit || !el.contains(hit);
          })
      )
        failures.push(`${name} is obscured`);
      if ((el.closest("label, .ui-slider") ?? el).getBoundingClientRect().height < 43.5)
        failures.push(`${name} has a hit area shorter than 44px`);
    }
  }
  return [...new Set(failures)];
}

export async function expectScrollFree(page: Page) {
  await expect
    .poll(() => page.evaluate(layoutViolations), {
      message: "Player UI must fit with accessible, bounded secondary scrolling and no hidden clipping",
    })
    .toEqual([]);
}
