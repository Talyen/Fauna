/** Re-arm the query when zoom or moving between displays changes the backing scale. */
export function installArtworkDensity() {
  let query: MediaQueryList | undefined;
  const update = () => {
    query?.removeEventListener("change", update);
    const ratio = window.devicePixelRatio || 1;
    document.documentElement.style.setProperty("--artwork-pixel-ratio", String(Math.max(2, ratio)));
    query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    query.addEventListener("change", update);
  };
  update();
  window.addEventListener("resize", update);
  return () => {
    query?.removeEventListener("change", update);
    window.removeEventListener("resize", update);
  };
}
