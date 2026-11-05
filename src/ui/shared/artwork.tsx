import { createContext, useContext, useEffect, useLayoutEffect } from "react";
import type { ArtworkCache } from "./artwork-cache";

export const ArtworkContext = createContext<ArtworkCache | null>(null);

/** The enclosing transition keeps the complete previous surface until every image is decoded. */
export function useArtwork(urls: readonly string[]) {
  const cache = useContext(ArtworkContext);
  const key = JSON.stringify(urls);
  useLayoutEffect(() => cache?.retain(JSON.parse(key) as string[]), [cache, key]);
  cache?.read(urls);
}

export function useUpcomingArtwork(urls: readonly string[]) {
  const cache = useContext(ArtworkContext);
  const key = JSON.stringify(urls);
  useEffect(() => cache?.prefetch(JSON.parse(key) as string[]), [cache, key]);
}
