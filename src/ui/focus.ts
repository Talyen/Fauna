/** Restore the player's place; a removed opener falls back to the current game surface. */
export function returnFocus(opener: HTMLElement | null) {
  const available = (element: HTMLElement | null): element is HTMLElement =>
    !!element?.isConnected &&
    !element.matches(":disabled") &&
    !element.closest('[inert], [aria-hidden="true"]') &&
    element.getClientRects().length > 0;
  if (available(opener)) {
    opener.focus();
    return;
  }
  const fallback =
    document.querySelector<HTMLElement>('.hand .action-card:not([aria-disabled="true"])') ??
    document.querySelector<HTMLElement>("main button:not(:disabled)") ??
    document.querySelector<HTMLElement>(".menu-button");
  if (available(fallback)) fallback.focus();
}
