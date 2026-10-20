import { afterEach, expect, it, vi } from "vitest";
import { createAudioRuntime, type MediaVoice } from "../../src/ui/audio-runtime";
import { defaultAudioPreferences, normalizeAudioPreferences } from "../../src/ui/audio-preferences";

function fixture(quiet = false) {
  const media: (MediaVoice & { url: string })[] = [];
  const report = vi.fn();
  const runtime = createAudioRuntime(
    report,
    (url) => {
      const voice = {
        url,
        volume: 0,
        loop: false,
        preload: "",
        onended: null,
        onerror: null,
        play: vi.fn(async () => {}),
        pause: vi.fn(),
        load: vi.fn(),
        removeAttribute: vi.fn(),
      };
      media.push(voice);
      return voice;
    },
    quiet,
  );
  return { runtime, media, report };
}
afterEach(() => vi.useRealTimers());
it("applies live volume, background mute, bounded voices and disposal", () => {
  vi.useFakeTimers();
  const { runtime, media } = fixture();
  runtime.configure({ ...defaultAudioPreferences, master: 50, effects: 40 });
  runtime.unlock();
  runtime.play("heal");
  expect(media.at(-1)!.volume).toBeCloseTo(0.2);
  const effects = media.at(-1)!;
  runtime.configure({ ...defaultAudioPreferences, master: 20, effects: 40 });
  expect(effects.volume).toBeCloseTo(0.08);
  for (let index = 0; index < 9; index++) runtime.play("block");
  expect(effects.pause).toHaveBeenCalled();
  runtime.background(true);
  const count = media.length;
  runtime.play("fire");
  expect(media).toHaveLength(count);
  runtime.background(false);
  runtime.music("boss");
  runtime.dispose();
  vi.runAllTimers();
  runtime.unlock();
  runtime.play("victory");
  expect(media.every((voice) => vi.mocked(voice.pause).mock.calls.length > 0)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("revokes late music callbacks without stopping replacement playback", async () => {
  vi.useFakeTimers();
  const { runtime, media } = fixture();
  runtime.unlock();
  vi.advanceTimersByTime(200);
  const old = media.at(-1)!,
    callback = old.onerror!;
  runtime.music("boss");
  const next = media.at(-1)!;
  callback();
  vi.advanceTimersByTime(200);
  expect(next.pause).not.toHaveBeenCalled();
  expect(next.volume).toBeGreaterThan(0);
  runtime.dispose();
});
it("never creates media in quiet previews and clamps persisted preferences", () => {
  const { runtime, media } = fixture(true);
  runtime.unlock();
  runtime.play("heal");
  runtime.music("boss");
  expect(media).toEqual([]);
  expect(normalizeAudioPreferences({ master: Infinity, music: -5, effects: 999, enabled: false })).toEqual({
    ...defaultAudioPreferences,
    music: 0,
    effects: 100,
    enabled: false,
  });
});

it("can retry music on a later gesture after initial playback is rejected", async () => {
  vi.useFakeTimers();
  const report = vi.fn();
  let attempts = 0;
  const runtime = createAudioRuntime(report, () => ({
    volume: 0,
    loop: false,
    preload: "",
    onended: null,
    onerror: null,
    pause() {},
    load() {},
    removeAttribute() {},
    play: async () => {
      if (++attempts === 1) throw new Error("Playback denied");
    },
  }));
  runtime.unlock();
  await Promise.resolve();
  await Promise.resolve();
  expect(report).toHaveBeenCalledTimes(1);
  runtime.unlock();
  expect(attempts).toBe(2);
  runtime.dispose();
  expect(vi.getTimerCount()).toBe(0);
});
