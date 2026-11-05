import type { ArtworkLease } from "./artwork-cache";

type Borrow = (url: string) => ArtworkLease | null;
const providers = new WeakMap<HTMLImageElement, Borrow>();
const leases = new WeakMap<HTMLElement, Set<ArtworkLease>>();

export function registerArtworkElement(image: HTMLImageElement, borrow: Borrow) {
  providers.set(image, borrow);
}

function copyAttributes(source: HTMLImageElement, target: HTMLImageElement) {
  for (const name of target.getAttributeNames()) if (name !== "src") target.removeAttribute(name);
  for (const attribute of source.attributes)
    if (attribute.name !== "src") target.setAttribute(attribute.name, attribute.value);
}

/** A decorative copy owns ready image elements; it never starts a visible image request. */
export function cloneArtworkElements(source: HTMLElement, clone: HTMLElement) {
  const owned = new Set<ArtworkLease>();
  const targets = [...clone.querySelectorAll("img")];
  for (const [index, image] of [...source.querySelectorAll("img")].entries()) {
    const borrow = providers.get(image);
    if (!borrow) continue;
    if (!image.checkVisibility()) {
      targets[index]!.remove();
      continue;
    }
    const lease = borrow(image.getAttribute("src")!);
    if (!lease) {
      for (const current of owned) current.release();
      return false;
    }
    owned.add(lease);
    copyAttributes(image, lease.image);
    providers.set(lease.image, borrow);
    targets[index]!.replaceWith(lease.image);
  }
  leases.set(clone, owned);
  clone.remove = () => {
    Element.prototype.remove.call(clone);
    for (const lease of owned) lease.release();
    owned.clear();
  };
  return true;
}

/** Flips swap complete prepared elements instead of changing a displayed image's URL. */
export function replaceVisualArtwork(clone: HTMLElement, image: HTMLImageElement, url: string) {
  const borrow = providers.get(image);
  if (!borrow) {
    image.src = url;
    return image;
  }
  const next = borrow(url);
  if (!next) return null;
  copyAttributes(image, next.image);
  providers.set(next.image, borrow);
  image.replaceWith(next.image);
  const owned = leases.get(clone)!;
  for (const previous of owned)
    if (previous.image === image) {
      owned.delete(previous);
      previous.release();
      break;
    }
  owned.add(next);
  return next.image;
}
