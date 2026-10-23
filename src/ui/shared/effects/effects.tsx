import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import { isKeywordId } from "../../../game/keywords";
import { createEffectsStore, currentEffectPalette, type ParticleScene } from "./effects-store";
import { effectPalette, type EffectPalette, type EffectTone } from "./palettes";
import { EffectBackground } from "./effect-background";

const Effects = createContext<ReturnType<typeof createEffectsStore> | null>(null);
const Scope = createContext("home");
export function EffectScope({ name, children }: { name: string; children: ReactNode }) {
  return <Scope.Provider value={name}>{children}</Scope.Provider>;
}
export function useEffectMetadata(keywords?: readonly string[], tone?: EffectTone) {
  return {
    "data-effect-keywords": keywords?.join(" "),
    "data-effect-tone": tone,
    "data-effect-scope": useContext(Scope),
  };
}
export function useEffectBaseline(palette: EffectPalette | null, priority = 0) {
  const effects = useContext(Effects),
    scope = useContext(Scope),
    owner = useId();
  const key = JSON.stringify(palette);
  useLayoutEffect(() => {
    const value = JSON.parse(key) as EffectPalette | null;
    if (value) return effects?.register(owner, { scope, palette: value, priority });
  }, [effects, owner, scope, key, priority]);
}
export function EffectBaseline({
  palette,
  priority = 0,
}: {
  palette: EffectPalette | null;
  priority?: number;
}) {
  useEffectBaseline(palette, priority);
  return null;
}
export function EffectsScene(props: {
  scope: string;
  scene: ParticleScene;
  glow: number;
  particles: number;
}) {
  const effects = useContext(Effects);
  const { scope, scene, glow, particles } = props;
  useLayoutEffect(
    () => effects?.configure({ scope, scene, glow, particles }),
    [effects, scope, scene, glow, particles],
  );
  return null;
}
export function EffectBackdropHost({ scope }: { scope: string }) {
  const effects = useContext(Effects);
  const ref = useCallback((node: HTMLDivElement | null) => effects?.host(scope, node), [effects, scope]);
  return <div ref={ref} className="effect-backdrop-host" aria-hidden="true" />;
}

function eligible(element: HTMLElement | null, scope: string) {
  return (
    element?.isConnected &&
    element.dataset.effectScope === scope &&
    !element.closest('[hidden], [inert], [aria-hidden="true"], [data-state="closed"]')
  );
}

/** One delegated observer also covers Radix portals without replacing control handlers. */
function observeInteractions(effects: ReturnType<typeof createEffectsStore>) {
  let pointer: HTMLElement | null = null;
  let suspended = document.hidden;
  const selector = "[data-effect-keywords], [data-effect-tone]";
  const source = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(selector) : null;
  let previousScope = effects.store.getState().scope;
  let signature = "";
  const sync = () => {
    const { scope } = effects.store.getState();
    if (scope !== previousScope) {
      pointer = null;
      previousScope = scope;
    }
    const navigation = document.documentElement.dataset.focus === "visible";
    const focused = navigation ? source(document.activeElement) : null;
    const candidate = suspended ? null : navigation ? focused : pointer;
    const element = eligible(candidate, scope) ? candidate : null;
    const next = element
      ? `${scope}:${element.dataset.effectTone ?? ""}:${element.dataset.effectKeywords ?? ""}`
      : "";
    if (next === signature) return;
    signature = next;
    effects.store.setState({
      interaction: element
        ? effectPalette(
            (element.dataset.effectKeywords ?? "").split(" ").filter(isKeywordId),
            element.dataset.effectTone as EffectTone | undefined,
          )
        : null,
    });
  };
  const move = (event: PointerEvent) => {
    pointer = source(event.target);
    sync();
  };
  const leave = (event: PointerEvent) => {
    pointer = source(event.relatedTarget);
    sync();
  };
  const blur = () => {
    suspended = true;
    pointer = null;
    sync();
  };
  const focus = () => {
    suspended = document.hidden;
    sync();
  };
  const visibility = () => {
    suspended = document.hidden;
    if (suspended) pointer = null;
    sync();
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "hidden",
      "inert",
      "aria-hidden",
      "data-state",
      "data-effect-keywords",
      "data-effect-tone",
    ],
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-input", "data-focus"],
  });
  document.addEventListener("pointerover", move);
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerout", leave);
  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", sync);
  window.addEventListener("blur", blur);
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", visibility);
  const unsubscribe = effects.store.subscribe(sync);
  return () => {
    unsubscribe();
    observer.disconnect();
    document.removeEventListener("pointerover", move);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerout", leave);
    document.removeEventListener("focusin", sync);
    document.removeEventListener("focusout", sync);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", focus);
    document.removeEventListener("visibilitychange", visibility);
  };
}

function Backdrops({ effects }: { effects: ReturnType<typeof createEffectsStore> }) {
  const state = useStore(effects.store);
  const palette = currentEffectPalette(state);
  const host = state.hosts.get(state.scope);
  const backdrop = (
    <EffectBackground palette={palette} scene={state.scene} glow={state.glow} particles={state.particles} />
  );
  return (
    <>
      <div className="effect-root" aria-hidden="true">
        {!host ? backdrop : null}
      </div>
      {host ? createPortal(backdrop, host) : null}
    </>
  );
}
export function VisualEffectsProvider({ children }: { children: ReactNode }) {
  const [effects] = useState(createEffectsStore);
  useEffect(() => observeInteractions(effects), [effects]);
  return (
    <Effects.Provider value={effects}>
      <Backdrops effects={effects} />
      {children}
    </Effects.Provider>
  );
}
