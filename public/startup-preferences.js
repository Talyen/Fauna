(() => {
  let scale = 1;
  try {
    const stored = Number(localStorage.getItem("fauna.game-scale") ?? "1");
    if (Number.isFinite(stored)) scale = Math.max(0.8, Math.min(1.2, Math.round(stored * 20) / 20));
  } catch {
    // Optional preferences never gate first paint.
  }
  const fit = Math.min(innerWidth / 1280, innerHeight / 720);
  const density = (fit <= 1 ? fit : 1 + (fit - 1) * 0.72) * scale;
  document.documentElement.style.setProperty("--ui-density", String(density));
  document.documentElement.style.setProperty("--text-scale", String(density));
  document.documentElement.style.setProperty(
    "--artwork-pixel-ratio",
    String(Math.max(2, globalThis.devicePixelRatio || 1)),
  );
})();
