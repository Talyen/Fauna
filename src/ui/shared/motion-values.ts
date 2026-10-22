/** Read the shared CSS token owner; absent styles settle immediately (including DOM-only tests). */
export function motionValue(token: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value * (raw.endsWith("s") && !raw.endsWith("ms") ? 1000 : 1) : 0;
}
