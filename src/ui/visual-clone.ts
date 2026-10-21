/** Decorative copy only: never duplicates focus ownership, IDs or accessible content. */
export function visualClone(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.inert = true;
  clone.setAttribute("inert", "");
  clone.setAttribute("aria-hidden", "true");
  for (const element of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
    element.removeAttribute("id");
    element.removeAttribute("autofocus");
    element.removeAttribute("aria-describedby");
    element.removeAttribute("aria-labelledby");
  }
  clone.style.pointerEvents = "none";
  return clone;
}
