import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { ArtworkCache } from "./artwork-cache";

export const ArtworkContext = createContext<ArtworkCache | null>(null);

/** The enclosing transition keeps the complete previous surface until every image is decoded. */
export function useArtwork(urls: readonly string[]) {
  const cache = useContext(ArtworkContext);
  // Draw order changes must not release ownership of the same decoded artwork group.
  const key = JSON.stringify([...new Set(urls)].sort());
  useLayoutEffect(() => cache?.retain(JSON.parse(key) as string[]), [cache, key]);
  useLayoutEffect(() => {
    cache?.committed();
  });
  cache?.read(urls);
}

/** Prepare a new portal group once; rerenders must not demand unused copies of its live images. */
export function useArtworkElements(urls: readonly string[]) {
  useArtwork(urls);
  const cache = useContext(ArtworkContext);
  const key = JSON.stringify(urls.slice().sort());
  const [prepared, setPrepared] = useState<{ cache: ArtworkCache; key: string } | null>(null);
  if (cache && (prepared?.cache !== cache || prepared.key !== key)) {
    cache.readElements(urls);
    setPrepared({ cache, key });
  }
}

export function useUpcomingArtwork(urls: readonly string[]) {
  const cache = useContext(ArtworkContext);
  const key = JSON.stringify(urls);
  useEffect(() => cache?.prefetch(JSON.parse(key) as string[]), [cache, key]);
}
