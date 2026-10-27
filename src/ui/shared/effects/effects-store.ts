import { createStore } from "zustand/vanilla";
import type { EffectPalette } from "./palettes";

export type ParticleScene = "default" | "battle" | "boss" | "campfire" | "none";
interface Source {
  scope: string;
  palette: EffectPalette;
  priority: number;
}
interface EffectsState {
  scope: string;
  scene: ParticleScene;
  glow: number;
  particles: number;
  sources: ReadonlyMap<string, Source>;
  interaction: EffectPalette | null;
  hosts: ReadonlyMap<string, HTMLElement>;
}

export function createEffectsStore() {
  const store = createStore<EffectsState>(() => ({
    scope: "home",
    scene: "none",
    glow: 0,
    particles: 0,
    sources: new Map(),
    interaction: null,
    hosts: new Map(),
  }));
  return {
    store,
    configure(next: Pick<EffectsState, "scope" | "scene" | "glow" | "particles">) {
      const previous = store.getState();
      if (Object.entries(next).every(([key, value]) => previous[key as keyof EffectsState] === value)) return;
      store.setState({ ...next, ...(previous.scope !== next.scope ? { interaction: null } : {}) });
    },
    register(owner: string, source: Source) {
      store.setState((state) => {
        const sources = new Map(state.sources);
        // Re-registering an owner is a new registration for tie-breaking.
        sources.delete(owner);
        sources.set(owner, { ...source });
        return { sources };
      });
      return () =>
        store.setState((state) => {
          const sources = new Map(state.sources);
          sources.delete(owner);
          return { sources };
        });
    },
    host(scope: string, node: HTMLElement | null) {
      store.setState((state) => {
        const hosts = new Map(state.hosts);
        if (node) hosts.set(scope, node);
        else hosts.delete(scope);
        return { hosts };
      });
    },
  };
}

export function currentEffectPalette(state: EffectsState): EffectPalette | null {
  if (state.interaction) return state.interaction;
  let selected: Source | undefined;
  for (const source of state.sources.values()) {
    if (source.scope === state.scope && (!selected || source.priority >= selected.priority))
      selected = source;
  }
  return selected?.palette ?? null;
}
