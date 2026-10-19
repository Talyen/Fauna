import type { Platform, SaveCandidate } from "./ports";
const KEY = "fauna.save.v1";
export function createBrowserPlatform(storage?: Storage): Platform {
  return {
    desktop: false,
    steam: { available: false },
    saves: {
      async readCandidates() {
        const source = storage ?? window.localStorage;
        const results: SaveCandidate[] = [];
        for (const key of [KEY, `${KEY}.backup1`, `${KEY}.backup2`]) {
          const data = source.getItem(key);
          if (data !== null) results.push({ source: key === KEY ? "primary" : "backup", data });
        }
        return results;
      },
      async write(data) {
        const source = storage ?? window.localStorage;
        for (let i = 2; i >= 1; i--) {
          const previous = source.getItem(i === 1 ? KEY : `${KEY}.backup${i - 1}`);
          if (previous !== null) source.setItem(`${KEY}.backup${i}`, previous);
        }
        source.setItem(KEY, data);
      },
    },
  };
}
