const fs = require("node:fs/promises");
const path = require("node:path");
const MINIMUM_CONTENT_SIZE = { width: 1280, height: 720 };
function minimumOuterSize(window) {
  const outer = window?.getBounds?.();
  const content = window?.getContentBounds?.();
  return {
    width: MINIMUM_CONTENT_SIZE.width + (outer && content ? Math.max(0, outer.width - content.width) : 0),
    height: MINIMUM_CONTENT_SIZE.height + (outer && content ? Math.max(0, outer.height - content.height) : 0),
  };
}
function clampBounds(bounds, displays, minimum = MINIMUM_CONTENT_SIZE) {
  const areas = displays.map((d) => d.workArea);
  const saved =
    bounds && ["x", "y", "width", "height"].every((key) => Number.isFinite(bounds[key])) ? bounds : {};
  const area = areas.find(
    (a) => saved.x >= a.x && saved.x < a.x + a.width && saved.y >= a.y && saved.y < a.y + a.height,
  ) ??
    areas[0] ?? { x: 0, y: 0, width: 1440, height: 1000 };
  const width = Math.min(Math.max(saved.width || 1440, minimum.width), area.width);
  const height = Math.min(Math.max(saved.height || 1000, minimum.height), area.height);
  return {
    x: Math.round(Math.max(area.x, Math.min(saved.x ?? area.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(saved.y ?? area.y, area.y + area.height - height))),
    width: Math.round(width),
    height: Math.round(height),
  };
}
/** @param {{directory: string, screen: import("electron").Screen, isolated?: boolean, notify?: (state: import("../src/platform/ports").DisplayState) => void}} options */
async function createDisplay({ directory, screen, isolated = false, notify = () => {} }) {
  const file = path.join(directory, "display.json");
  /** @type {{mode: "windowed" | "fullscreen", bounds: import("electron").Rectangle | null}} */
  let preferences = { mode: "windowed", bounds: null };
  if (!isolated)
    try {
      const value = JSON.parse(await fs.readFile(file, "utf8"));
      if (["windowed", "fullscreen"].includes(value.mode)) preferences = value;
    } catch {
      /* Missing/invalid optional device preferences use defaults. */
    }
  let window,
    timer,
    disposed = false,
    lane = Promise.resolve(),
    transition = /** @type {Promise<unknown>} */ (Promise.resolve());
  const bounds = () => clampBounds(preferences.bounds, screen.getAllDisplays(), minimumOuterSize(window));
  const write = () => {
    clearTimeout(timer);
    timer = undefined;
    if (isolated) return;
    const data = JSON.stringify(preferences);
    lane = lane
      .then(async () => {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${file}.tmp`, data);
        await fs.rename(`${file}.tmp`, file);
      })
      .catch(() => {
        notify({ ...read(), error: "Could not remember display preferences." });
      });
  };
  /** @returns {import("../src/platform/ports").DisplayState} */
  const read = () => ({
    mode:
      window && !window.isDestroyed()
        ? window.isFullScreen() || window.isSimpleFullScreen?.()
          ? "fullscreen"
          : "windowed"
        : preferences.mode,
  });
  const recover = () => {
    if (disposed || !window || window.isDestroyed() || read().mode !== "windowed") return;
    const next = clampBounds(window.getBounds(), screen.getAllDisplays(), minimumOuterSize(window));
    const minimum = minimumOuterSize(window);
    window.setMinimumSize?.(Math.min(minimum.width, next.width), Math.min(minimum.height, next.height));
    window.setBounds(next);
    preferences.bounds = next;
    write();
  };
  const publish = () => {
    if (disposed) return;
    preferences.mode = read().mode;
    notify(read());
    write();
  };
  const remember = () => {
    if (disposed || !window || window.isDestroyed() || read().mode !== "windowed") return;
    preferences.bounds = window.getBounds();
    clearTimeout(timer);
    timer = setTimeout(write, 250);
  };
  /** @param {"windowed" | "fullscreen"} mode */
  const apply = async (mode) => {
    if (disposed || !window || window.isDestroyed() || !["windowed", "fullscreen"].includes(mode))
      throw new Error("Invalid display request.");
    if (isolated) return read();
    if (mode === "fullscreen" && read().mode === "windowed") preferences.bounds = window.getBounds();
    if (process.platform === "darwin") window.setSimpleFullScreen(mode === "fullscreen");
    else if (window.isFullScreen() !== (mode === "fullscreen")) {
      await new Promise((resolve, reject) => {
        const event = mode === "fullscreen" ? "enter-full-screen" : "leave-full-screen";
        const done = () => {
          clearTimeout(timeout);
          resolve(undefined);
        };
        const timeout = setTimeout(() => {
          window.removeListener(event, done);
          reject(new Error("Display transition did not complete."));
        }, 2000);
        window.once(event, done);
        window.setFullScreen(mode === "fullscreen");
      });
    }
    if (mode === "windowed") {
      const next = bounds();
      const minimum = minimumOuterSize(window);
      window.setMinimumSize?.(Math.min(minimum.width, next.width), Math.min(minimum.height, next.height));
      window.setBounds(next);
    }
    preferences.mode = mode;
    write();
    return read();
  };
  /** @param {"windowed" | "fullscreen"} mode */
  const set = (mode) => {
    const result = transition.then(() => apply(mode));
    transition = result.catch(() => {});
    return result;
  };
  return {
    bounds,
    read,
    set,
    attach(target) {
      window = target;
      if (!isolated) recover();
      screen.on?.("display-removed", recover);
      screen.on?.("display-metrics-changed", recover);
      window.on("move", remember);
      window.on("resize", remember);
      window.on("enter-full-screen", publish);
      window.on("leave-full-screen", publish);
      if (!isolated && preferences.mode === "fullscreen")
        void set("fullscreen").catch(() => notify({ ...read(), error: "Could not restore fullscreen." }));
    },
    async dispose() {
      disposed = true;
      clearTimeout(timer);
      screen.removeListener?.("display-removed", recover);
      screen.removeListener?.("display-metrics-changed", recover);
      if (window && !window.isDestroyed()) {
        window.removeListener("move", remember);
        window.removeListener("resize", remember);
        window.removeListener("enter-full-screen", publish);
        window.removeListener("leave-full-screen", publish);
      }
      // Native fullscreen completion can still update preferences and enqueue a write.
      // Drain it before taking the final snapshot or declaring teardown complete.
      await transition;
      preferences.mode = read().mode;
      write();
      await lane;
    },
  };
}
module.exports = { clampBounds, createDisplay, minimumOuterSize };
