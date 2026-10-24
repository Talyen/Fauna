import { expect } from "@playwright/test";
import { test } from "./support/session";
import { settleScreen } from "./support/rendered-evidence";

test("rendered evidence waits for chained and replacement transitions while decoration continues", async ({
  page,
}) => {
  await page.setContent(
    '<main><div id="chain">Moving card</div><div id="replacement">Replacement</div><div id="loop">Decoration</div></main>',
  );
  await page.evaluate(() => {
    const frames = [{ opacity: 0.5 }, { opacity: 1 }];
    document.querySelector("#loop")!.animate(frames, { duration: 100, iterations: Infinity });
    const chain = document.querySelector("#chain")!;
    const first = chain.animate(frames, { duration: 80 });
    void first.finished.then(() => {
      const second = chain.animate(frames, { duration: 80 });
      void second.finished.then(() => {
        chain.setAttribute("data-settled", "true");
      });
    });
    const replacement = document.querySelector("#replacement")!;
    const cancelled = replacement.animate(frames, { duration: 10_000 });
    void cancelled.finished.catch(() => {
      const next = replacement.animate(frames, { duration: 100 });
      void next.finished.then(() => {
        replacement.setAttribute("data-settled", "true");
      });
    });
    cancelled.cancel();
  });
  await settleScreen(page);
  // Read once: retrying these assertions could hide an early return from settleScreen.
  expect(
    await page.evaluate(() => ({
      chain: document.querySelector("#chain")!.getAttribute("data-settled"),
      replacement: document.querySelector("#replacement")!.getAttribute("data-settled"),
      decoration: document.querySelector("#loop")!.getAnimations()[0]!.playState,
    })),
  ).toEqual({ chain: "true", replacement: "true", decoration: "running" });
});
