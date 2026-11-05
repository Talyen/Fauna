import { expect, type Locator } from "@playwright/test";

/** A cold page may retain the previous complete composition until its artwork is ready. */
export async function changePage(root: Locator, direction: "Next" | "Previous" = "Next") {
  const button = root.getByRole("button", { name: `${direction} page`, exact: true });
  const pager = button.locator("..");
  const before = await pager.getAttribute("data-page");
  if (before === null) throw new Error("Expected the shared page controls");
  await button.click();
  await expect(pager).not.toHaveAttribute("data-page", before);
}
