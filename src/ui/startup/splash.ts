export const STARTUP_MINIMUM_MS = 5000;
const PHRASES = [
  "Adventure awaits…",
  "Shuffling decks…",
  "Waking creatures…",
  "Exploring habitats…",
  "Preparing expeditions…",
  "Training starters…",
  "Gathering Boons…",
  "Restocking shops…",
];

/** The HTML element and its animation clock survive the React import and all renders. */
export function createStartupSplash() {
  const element = document.getElementById("startup-splash");
  const phrase = document.getElementById("startup-splash-phrase");
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let index = 0;
  let words: ReturnType<typeof setInterval> | undefined;
  let removal: ReturnType<typeof setTimeout> | undefined;
  let dismissed = false;
  const stopWords = () => clearInterval(words);
  const updateMotion = () => {
    stopWords();
    if (motion?.matches || dismissed) return;
    words = setInterval(() => {
      index = (index + 1) % PHRASES.length;
      if (phrase) {
        phrase.textContent = PHRASES[index]!;
        phrase.style.animation = "none";
        void phrase.offsetHeight;
        phrase.style.animation = "";
      }
    }, 750);
  };
  updateMotion();
  motion?.addEventListener("change", updateMotion);
  let finishMinimum = () => {};
  const minimum = new Promise<void>((resolve) => {
    finishMinimum = resolve;
  });
  const timer = setTimeout(finishMinimum, Math.max(0, STARTUP_MINIMUM_MS - performance.now()));
  const remove = () => {
    clearTimeout(removal);
    element?.removeEventListener("transitionend", onTransitionEnd);
    element?.remove();
  };
  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target === element && event.propertyName === "opacity") remove();
  };
  return {
    minimum,
    dismiss() {
      if (dismissed) return;
      dismissed = true;
      stopWords();
      motion?.removeEventListener("change", updateMotion);
      element?.setAttribute("aria-busy", "false");
      if (motion?.matches) remove();
      else {
        element?.classList.add("startup-dismissed");
        element?.addEventListener("transitionend", onTransitionEnd);
        removal = setTimeout(remove, 400);
      }
    },
    dispose() {
      stopWords();
      clearTimeout(timer);
      finishMinimum();
      motion?.removeEventListener("change", updateMotion);
      remove();
    },
  };
}
export type StartupSplash = ReturnType<typeof createStartupSplash>;
