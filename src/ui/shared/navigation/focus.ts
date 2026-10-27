export const isAvailableFocusTarget = (element: HTMLElement | null): element is HTMLElement =>
  !!element?.isConnected &&
  !element.matches(":disabled") &&
  !element.closest(
    '[hidden], [inert], [aria-hidden="true"], [role="dialog"][data-state="closed"], [role="alertdialog"][data-state="closed"]',
  ) &&
  element.getClientRects().length > 0;

/** Restore the player's place; a removed opener falls back to the current game surface. */
export function returnFocus(opener: HTMLElement | null) {
  if (isAvailableFocusTarget(opener)) {
    opener.focus({ preventScroll: true });
    return;
  }
  for (const selector of [
    '.hand .action-card:not([aria-disabled="true"])',
    "main button:not(:disabled)",
    ".menu-button",
  ]) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isAvailableFocusTarget(element)) continue;
      element.focus({ preventScroll: true });
      return;
    }
  }
}
