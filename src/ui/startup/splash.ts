const STARTUP_MINIMUM_MS = 5000;
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
  let finished = false;
  const stopWords = () => clearInterval(words);
  const updateMotion = () => {
    stopWords();
    if (motion?.matches || finished) return;
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
  const finish = () => {
    finished = true;
    stopWords();
    clearTimeout(timer);
    finishMinimum();
    motion?.removeEventListener("change", updateMotion);
    element?.setAttribute("aria-busy", "false");
  };
  return {
    minimum,
    dismiss() {
      if (finished) return;
      finish();
      if (motion?.matches) remove();
      else {
        element?.classList.add("startup-dismissed");
        element?.addEventListener("transitionend", onTransitionEnd);
        removal = setTimeout(remove, 400);
      }
    },
    fail() {
      if (finished) return;
      element?.classList.add("startup-failed");
      element?.removeAttribute("aria-label");
      element?.setAttribute("aria-labelledby", "startup-splash-phrase");
      if (phrase) {
        phrase.removeAttribute("aria-hidden");
        phrase.textContent = "Fauna could not start";
      }
      finish();
    },
    dispose() {
      finish();
      remove();
    },
  };
}
export type StartupSplash = ReturnType<typeof createStartupSplash>;
