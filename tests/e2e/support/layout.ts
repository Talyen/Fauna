import { expect, type Page } from "@playwright/test";

export async function fits(page: Page) {
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth <= innerWidth,
      height: document.documentElement.scrollHeight <= innerHeight,
    })),
  ).toEqual({ width: true, height: true });
}

/** Preserve the overview's composition, readable captions and largest fitting artwork */
export async function expectTalentOverview(page: Page) {
  const layout = await page.locator(".talents-screen").evaluate((screen) => {
    const categories = [...screen.querySelectorAll(".talent-category")];
    const arts = categories.map((category) => category.querySelector(".action-card")!);
    const inside = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
    };
    const rows = new Map<number, number>();
    for (const art of arts) {
      const top = Math.round(art.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    const overview = screen.querySelector(".talent-overview")!;
    const viewport = screen.querySelector(".talent-overview-viewport")!;
    const gap = parseFloat(getComputedStyle(overview).columnGap);
    const captions = Math.max(
      ...categories.map((category) =>
        [...category.querySelectorAll("h2, p")].reduce(
          (sum, caption) => sum + caption.getBoundingClientRect().height,
          0,
        ),
      ),
    );
    const actual = arts[0]!.getBoundingClientRect().width;
    const largest = Math.min(
      categories[0]!.getBoundingClientRect().width,
      ((viewport.clientHeight - parseFloat(getComputedStyle(overview).rowGap) * 2) / 3 -
        captions -
        parseFloat(getComputedStyle(arts[0]!).marginBottom)) *
        0.75,
    );
    return {
      fits: screen.scrollHeight <= screen.clientHeight && screen.scrollWidth <= screen.clientWidth,
      captionsVisible: categories.every((category) => [...category.children].every(inside)),
      captionsReadable: categories.every((category) =>
        [...category.querySelectorAll("h2, p")].every(
          (caption) =>
            caption.scrollWidth <= caption.clientWidth && caption.scrollHeight <= caption.clientHeight,
        ),
      ),
      portraits: arts.every((art) => {
        const box = art.getBoundingClientRect();
        return Math.abs(box.width / box.height - 0.75) < 0.01 && box.height >= 44;
      }),
      columns: categories.every(
        (category, index) =>
          index % 5 === 0 ||
          Math.abs(
            category.getBoundingClientRect().left -
              categories[index - 1]!.getBoundingClientRect().right -
              gap,
          ) < 1,
      ),
      rows: [...rows.values()],
      actual,
      largest,
    };
  });
  expect(layout).toEqual({
    fits: true,
    captionsVisible: true,
    captionsReadable: true,
    portraits: true,
    columns: true,
    rows: [5, 5, 5],
    actual: expect.any(Number),
    largest: expect.any(Number),
  });
  expect(layout.actual).toBeCloseTo(layout.largest, 0);
}
