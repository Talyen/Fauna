import { mkdir, writeFile } from "node:fs/promises";

// Original vector placeholders, kept separate from the creature-art generator.
const places = [
  ["briar-hollow", "#293e31", "#9baf74", "hollow"],
  ["mossy-stream", "#29484a", "#91b6aa", "stream"],
  ["ember-grove", "#503e39", "#d4a878", "grove"],
  ["silken-clearing", "#453c59", "#c6b3c9", "clearing"],
  ["hollow-heart", "#27372e", "#b8b378", "heart"],
  ["reed-banks", "#304b50", "#b1c599", "reeds"],
  ["flooded-grove", "#293c49", "#8caaa7", "flood"],
  ["firefly-pool", "#333d4e", "#d5ce98", "pool"],
  ["mist-island", "#424c59", "#bbc8c0", "island"],
  ["moonwell", "#30384f", "#b7c8df", "well"],
];
await mkdir("public/art/locations", { recursive: true });
for (const [id, sky, light, motif] of places) {
  const water = ["stream", "reeds", "flood", "pool", "island", "well"].includes(motif);
  const trees = [100, 230, 590, 730]
    .map(
      (x, i) =>
        `<path d="M${x - 35} 540Q${x + 35} 290 ${x - 15} 0H${x + 35}Q${x + 15} 290 ${x + 65} 540Z" fill="${i % 2 ? "#243c36" : "#192f2e"}"/><path d="M${x + 10} 240L${x - 80} 130M${x + 10} 175L${x + 95} 80" stroke="#243c36" stroke-width="22" fill="none"/>`,
    )
    .join("");
  const focal =
    motif === "hollow" || motif === "heart"
      ? `<path d="M225 490Q270 340 255 150Q400 70 545 150Q530 340 575 490Z" fill="#435040"/><path d="M320 480V335Q400 220 480 335V480Z" fill="#142b27"/><path d="M240 485Q290 360 315 250M560 485Q510 360 485 250" stroke="${light}" stroke-width="8" fill="none"/>${motif === "heart" ? '<path d="m315 260-40-70 80 30m130 40 40-70-80 30" fill="#a8a779"/>' : ""}`
      : motif === "well"
        ? `<ellipse cx="400" cy="425" rx="145" ry="62" fill="#5c6d7c"/><ellipse cx="400" cy="415" rx="112" ry="42" fill="#bfd2df"/><path d="M260 425v55q140 80 280 0v-55" fill="none" stroke="#7c8e98" stroke-width="18"/>`
        : motif === "island"
          ? '<ellipse cx="400" cy="420" rx="160" ry="52" fill="#60796a"/><path d="M400 415V215m0 65-65-65m65 30 65-75" stroke="#354b43" stroke-width="20" fill="none"/>'
          : motif === "grove"
            ? `<path d="M260 440Q400 250 540 440Z" fill="#84705a"/><g fill="${light}"><ellipse cx="325" cy="415" rx="30" ry="14"/><ellipse cx="450" cy="390" rx="40" ry="18"/></g>`
            : motif === "clearing"
              ? `<path d="M210 460Q400 270 590 460Z" fill="#6b7864"/><path d="M190 160Q400 300 610 160M190 190Q400 330 610 190" fill="none" stroke="${light}" stroke-width="3" opacity=".65"/>`
              : "";
  const reeds = Array.from({ length: 18 }, (_, i) => {
    const x = i < 9 ? 20 + i * 20 : 620 + (i - 9) * 20;
    return `<path d="M${x} 600q20-90 5-${100 + (i % 4) * 25}" stroke="#788e62" stroke-width="5" fill="none"/>`;
  }).join("");
  const lights = Array.from(
    { length: 20 },
    (_, i) =>
      `<circle cx="${(i * 137 + 73) % 800}" cy="${(i * 83 + 100) % 440}" r="${(i % 3) + 1}" fill="${light}" opacity=".65"/>`,
  ).join("");
  await writeFile(
    `public/art/locations/${id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#152e2c"/></linearGradient></defs><path fill="url(#sky)" d="M0 0H800V600H0Z"/><circle cx="405" cy="145" r="${motif === "well" ? 76 : 42}" fill="${light}" opacity=".45"/><path d="M0 375Q200 290 400 370T800 340V600H0Z" fill="#304b40"/>${trees}${water ? `<path d="M330 345Q460 390 360 450T420 600H800V390Q590 440 520 345Z" fill="#648b91" opacity=".8"/><path d="M420 470h190m-220 38h150m-80 45h230" stroke="${light}" stroke-width="4" opacity=".5"/>` : '<path d="M355 350Q460 440 250 600H590Q450 450 410 350Z" fill="#75836a" opacity=".5"/>'}${focal}<path d="M0 520Q120 460 250 530L180 600H0M800 515Q670 460 550 540L610 600H800" fill="#19372f"/>${reeds}${lights}</svg>`,
  );
}
