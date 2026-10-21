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
    opener.focus();
    return;
  }
  const fallback = [
    '.hand .action-card:not([aria-disabled="true"])',
    "main button:not(:disabled)",
    ".menu-button",
  ]
    .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
    .find(isAvailableFocusTarget);
  fallback?.focus();
}
