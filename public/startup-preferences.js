(() => {
  try {
    const scale = Number(localStorage.getItem("fauna.text-scale") ?? "1");
    if ([0.75, 1, 1.25].includes(scale))
      document.documentElement.style.setProperty("--text-scale", String(scale));
  } catch {
    // Optional preferences never gate first paint.
  }
})();
