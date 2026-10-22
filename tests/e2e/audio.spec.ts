import { test, expect } from "@playwright/test";
import { produce } from "immer";
import { assetUrl } from "../../src/ui/shared/assets";
import prepared from "../../src/assets/prepared.json" with { type: "json" };
import { run } from "../support/game";
import { seed, resume } from "./support/session";

test("real audio output, hit recoil, reduced motion, and mute follow combat outcomes", async ({ page }) => {
  const soundUrls = Object.keys(prepared.records)
    .filter((id) => id.startsWith("sound."))
    .map(assetUrl);
  await page.addInitScript((sources) => {
    const soundUrls = new Set(sources.map((source) => new URL(source, location.href).href));
    const observed = { peak: 0, media: [] as HTMLMediaElement[], impacts: [] as string[] };
    Object.assign(window, { combatObserved: observed });
    const nativePlay = HTMLMediaElement.prototype.play;
    const connected = new WeakSet<HTMLMediaElement>();
    HTMLMediaElement.prototype.play = function () {
      if (!connected.has(this) && soundUrls.has(this.src)) {
        connected.add(this);
        observed.media.push(this);
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        context.createMediaElementSource(this).connect(analyser);
        analyser.connect(context.destination);
        void context.resume();
        const samples = new Float32Array(analyser.fftSize);
        const timer = setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          for (const sample of samples) observed.peak = Math.max(observed.peak, Math.abs(sample));
          if (this.paused) {
            clearInterval(timer);
            void context.close();
          }
        }, 5);
      }
      return nativePlay.call(this);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches(".combatant-reaction"))
        observed.impacts.push(this.closest<HTMLElement>("[data-actor-id]")?.dataset.actorId ?? "");
      return animate.call(this, frames, options);
    };
  }, soundUrls);
  const fixture = produce(run(7), (d) => {
    const cards = d.cards.filter((c) =>
      ["mossguard-attack", "emberback-attack", "prismram-attack"].includes(c.definitionId),
    );
    d.battle!.hand = cards.map((c) => c.id);
    d.battle!.draw = d.cards.filter((c) => !cards.some((card) => card.id === c.id)).map((c) => c.id);
    d.battle!.discard = [];
    d.battle!.enemies.forEach((enemy) => {
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 1;
    });
  });
  await seed(page, fixture);
  await resume(page);
  await page.locator('.app:not([inert]) .hand [data-card-id="ally-0:mossguard-attack"]').click();
  await page.locator(".confirm-play").click();
  const observed = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            combatObserved: { peak: number; media: HTMLMediaElement[]; impacts: string[] };
          }
        ).combatObserved,
    );
  await expect.poll(async () => (await observed()).peak).toBeGreaterThan(0.001);
  expect((await observed()).impacts).toContain("enemy-0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const count = (await observed()).impacts.length;
  await page.locator('.app:not([inert]) .hand [data-card-id="ally-1:emberback-attack"]').click();
  await page.getByRole("button", { name: "Target Pollenmoth", exact: true }).click();
  expect((await observed()).impacts).toHaveLength(count);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await page.getByRole("switch", { name: "Sound", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Continue" }).click();
  const mediaCount = (await observed()).media.length;
  await page.getByRole("button", { name: "End turn" }).click();
  await page.waitForTimeout(400);
  expect((await observed()).media).toHaveLength(mediaCount);
  expect(
    await page.evaluate(() =>
      (window as unknown as { combatObserved: { media: HTMLMediaElement[] } }).combatObserved.media.every(
        (media) => media.paused,
      ),
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Sound", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Sound", exact: true })).not.toBeChecked();
});
