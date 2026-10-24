import { afterEach, expect, it, vi } from "vitest";
import { createAudioRuntime, type MediaVoice } from "../../../src/ui/audio/audio-runtime";
import { defaultAudioPreferences, normalizeAudioPreferences } from "../../../src/ui/settings/preferences";

function fixture(quiet = false, beforeCreate = (_url: string) => {}, playback = () => Promise.resolve()) {
  const media: (MediaVoice & { url: string })[] = [];
  const report = vi.fn();
  const runtime = createAudioRuntime(
    report,
    (url) => {
      beforeCreate(url);
      const voice = {
        url,
        volume: 0,
        loop: false,
        preload: "" as const,
        onended: null,
        onerror: null,
        play: vi.fn(playback),
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
it("recreates the previous track after a failed transition instead of replaying released media", () => {
  vi.useFakeTimers();
  let fail = false;
  const { runtime, media, report } = fixture(false, () => {
    if (fail) throw new Error("Media unavailable");
  });
  runtime.unlock();
  vi.advanceTimersByTime(200);
  const old = media.at(-1)!;
  fail = true;
  runtime.music("boss");
  vi.advanceTimersByTime(200);
  expect(report).toHaveBeenCalledTimes(1);
  expect(old.removeAttribute).toHaveBeenCalledWith("src");
  fail = false;
  runtime.music("menu");
  expect(media.at(-1)).not.toBe(old);
  expect(vi.mocked(old.play)).toHaveBeenCalledTimes(1);
  expect(media.at(-1)!.play).toHaveBeenCalledTimes(1);
  runtime.dispose();
});
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
  const disposedCount = media.length;
  vi.runAllTimers();
  runtime.unlock();
  runtime.play("victory");
  runtime.music("combat");
  runtime.configure(defaultAudioPreferences);
  runtime.background(false);
  expect(media).toHaveLength(disposedCount);
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
  callback(new Event("error"));
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
    preload: "" as const,
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

it("keeps activation quieter than combat across live volume changes and mute", () => {
  const { runtime, media } = fixture();
  runtime.configure({ ...defaultAudioPreferences, master: 50, effects: 50 });
  runtime.unlock();
  runtime.play("activate");
  const click = media.at(-1)!;
  expect(click.volume).toBeCloseTo(0.25 * 0.35);
  runtime.configure({ ...defaultAudioPreferences, master: 100, effects: 50 });
  expect(click.volume).toBeCloseTo(0.5 * 0.35);
  runtime.configure({ ...defaultAudioPreferences, enabled: false });
  const count = media.length;
  runtime.play("activate");
  expect(media).toHaveLength(count);
  runtime.dispose();
});

it("owns one pending music start across gestures and preference updates", async () => {
  vi.useFakeTimers();
  let rejectStart!: (error: Error) => void;
  const play = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        rejectStart = reject;
      }),
  );
  const runtime = createAudioRuntime(vi.fn(), () => ({
    volume: 0,
    loop: false,
    preload: "" as const,
    onended: null,
    onerror: null,
    play,
    pause() {},
    load() {},
    removeAttribute() {},
  }));
  runtime.unlock();
  runtime.unlock();
  runtime.configure(defaultAudioPreferences);
  expect(play).toHaveBeenCalledTimes(1);
  rejectStart(new Error("Playback denied"));
  await Promise.resolve();
  runtime.unlock();
  expect(play).toHaveBeenCalledTimes(2);
  runtime.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps rapid music changes on their original fade timing and releases superseded tracks once", () => {
  vi.useFakeTimers();
  const { runtime, media } = fixture();
  runtime.unlock();
  const menu = media.at(-1)!;
  vi.advanceTimersByTime(60);
  expect(menu.volume).toBeCloseTo(0.1);
  runtime.music("boss");
  const boss = media.at(-1)!;
  vi.advanceTimersByTime(30);
  expect(menu.volume).toBeCloseTo(0.05);
  expect(boss.volume).toBeCloseTo(0.05);
  runtime.music("combat");
  const combat = media.at(-1)!;
  expect(menu.removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
  vi.advanceTimersByTime(30);
  expect(boss.removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
  expect(combat.volume).toBeCloseTo(0.05);
  vi.advanceTimersByTime(120);
  expect(combat.volume).toBeCloseTo(0.25);
  expect(combat.pause).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  runtime.dispose();
  runtime.dispose();
  for (const voice of media) expect(voice.removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
});

it.each(["resolve", "reject"] as const)(
  "ignores pending music and effect playback that %s after disposal",
  async (outcome) => {
    vi.useFakeTimers();
    const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
    const { runtime, media, report } = fixture(
      false,
      undefined,
      () => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })),
    );
    runtime.unlock();
    runtime.play("heal");
    const callbacks = media.map((voice) => voice.onerror).filter((callback) => callback !== null);
    expect(pending).toHaveLength(2);
    runtime.dispose();
    for (const operation of pending) {
      if (outcome === "resolve") operation.resolve();
      else operation.reject(new Error("Late playback failure"));
    }
    for (const callback of callbacks) callback(new Event("error"));
    await Promise.resolve();
    vi.runAllTimers();
    expect(report).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    for (const voice of media) {
      expect(voice.removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
      expect(voice.onended).toBeNull();
      expect(voice.onerror).toBeNull();
    }
  },
);

it("mutes both sides of a crossfade and resumes only the current track", async () => {
  vi.useFakeTimers();
  const { runtime, media } = fixture();
  runtime.unlock();
  vi.advanceTimersByTime(150);
  const menu = media.at(-1)!;
  runtime.music("boss");
  const boss = media.at(-1)!;
  vi.advanceTimersByTime(30);
  expect(menu.volume).toBeGreaterThan(0);
  expect(boss.volume).toBeGreaterThan(0);
  runtime.background(true);
  expect(menu.removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
  expect(boss.pause).toHaveBeenCalledTimes(1);
  expect(boss.volume).toBe(0);
  vi.advanceTimersByTime(150);
  expect(boss.volume).toBe(0);
  await Promise.resolve();
  const count = media.length;
  runtime.background(false);
  expect(media).toHaveLength(count);
  expect(boss.volume).toBeCloseTo(0.25);
  expect(boss.play).toHaveBeenCalledTimes(2);
  expect(menu.play).toHaveBeenCalledTimes(1);
  runtime.dispose();
  expect(vi.getTimerCount()).toBe(0);
});
