import { motionValue } from "../shared/motion-values";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
const Finished = createContext(true);
export function ResultPresentation({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(() => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const finish = () => setDone(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (reduced?.matches) finish();
    };
    reduced?.addEventListener?.("change", change);
    const element = root.current;
    for (const event of ["pointermove", "pointerdown", "keydown", "click", "focusin"])
      element?.addEventListener(event, finish, true);
    return () => {
      reduced?.removeEventListener?.("change", change);
      for (const event of ["pointermove", "pointerdown", "keydown", "click", "focusin"])
        element?.removeEventListener(event, finish, true);
    };
  }, []);
  return (
    <Finished.Provider value={done}>
      <div className="result-presentation" data-finished={done} ref={root}>
        {children}
      </div>
    </Finished.Provider>
  );
}
export function AnimatedNumber({ value }: { value: number }) {
  const done = useContext(Finished);
  const [shown, setShown] = useState(done ? value : 0);
  useEffect(() => {
    const duration = motionValue("--motion-result");
    if (done || !duration) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / duration);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, done]);
  return (
    <span className="animated-number">
      <span className="sr-only">{value}</span>
      <span className="number-reserve" aria-hidden="true">
        {value}
      </span>
      <span className="number-value" aria-hidden="true">
        {done ? value : shown}
      </span>
    </span>
  );
}
