import { mkdir, writeFile } from "node:fs/promises";
const creatures = [
  ["emberfox", "#dc8a53", "#553f39"],
  ["stormfin", "#83b8b9", "#233d4c"],
  ["silkmoth", "#ceb4c6", "#453c59"],
  ["briartooth", "#a5a05a", "#394136"],
  ["moonhart", "#b0bfda", "#343d59"],
];
await mkdir("public/art", { recursive: true });
for (const [index, [id, body, bg]] of creatures.entries()) {
  for (const portrait of [false, true]) {
    const w = portrait ? 600 : 800,
      h = portrait ? 800 : 600;
    const horns =
      id === "emberfox"
        ? '<path d="M280 285 270 155 350 255M450 255 530 155 520 285" fill="' + body + '"/>'
        : id === "moonhart"
          ? '<path d="M320 260 290 145 245 105M290 145 335 100M480 260 510 145 555 105M510 145 465 100" fill="none" stroke="' +
            body +
            '" stroke-width="20" stroke-linecap="round"/>'
          : id === "silkmoth"
            ? '<ellipse cx="265" cy="315" rx="140" ry="170" fill="#b399b9"/><ellipse cx="535" cy="315" rx="140" ry="170" fill="#b399b9"/><ellipse cx="245" cy="275" rx="55" ry="75" fill="#ece0b7" opacity=".55"/><ellipse cx="555" cy="275" rx="55" ry="75" fill="#ece0b7" opacity=".55"/>'
            : id === "stormfin"
              ? '<path d="m365 275 20-150 65 105 65-30-35 120" fill="#c3d8c1"/>'
              : '<path d="m290 285-45-100 105 65m100 0 105-65-45 100" fill="' + body + '"/>';
    const scene = `<circle cx="610" cy="135" r="68" fill="#e9dfa7" opacity=".24"/><path d="M0 480Q150 335 350 435T800 390V600H0" fill="#172d29"/><path d="M0 520Q170 470 340 510T800 465V600H0" fill="#102722"/><g opacity=".55" stroke="#182e28" fill="none" stroke-width="18"><path d="M90 600Q125 290 65 0M710 600Q665 280 750 0"/><path d="m95 325 105-90m-95-75L20 80m680 240-100-85m100-80 90-70"/></g><g transform="translate(0 20)"><ellipse cx="400" cy="490" rx="170" ry="28" fill="#071d18" opacity=".65"/>${horns}<path d="M250 475Q230 345 285 290Q325 245 400 250Q475 245 515 290Q570 345 550 475L490 490 470 445 330 445 310 490Z" fill="${body}" stroke="#172b29" stroke-width="8"/><ellipse cx="400" cy="385" rx="117" ry="92" fill="#f4e5ad" opacity=".18"/><path d="M315 328q30-22 58 0m54 0q30-22 58 0" fill="none" stroke="#203330" stroke-width="9" stroke-linecap="round"/><ellipse cx="345" cy="354" rx="13" ry="19" fill="#182c28"/><ellipse cx="455" cy="354" rx="13" ry="19" fill="#182c28"/><circle cx="349" cy="348" r="4" fill="#fbefbc"/><circle cx="459" cy="348" r="4" fill="#fbefbc"/><path d="m385 389 15 12 15-12m-37 33q22 17 44 0" stroke="#243a30" stroke-width="6" fill="none" stroke-linecap="round"/>${id === "briartooth" ? '<path d="m260 360-35-25 25 70m300-45 35-25-25 70" fill="#cfcb87"/>' : ""}</g><g fill="#c9cf9a" opacity=".65">${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 173 + index * 41) % 800}" cy="${(i * 97 + index * 31) % 570}" r="${(i % 3) + 1}"/>`).join("")}</g><g stroke="#5c7753" stroke-width="5" fill="none" opacity=".75"><path d="M20 600Q80 490 150 465M35 565l-5-50m34 13 50-3M780 600Q720 490 650 465m115 100 5-50m-34 13-50-3"/></g>`;
    const transform = portrait ? "translate(-110 100) scale(1.025)" : "translate(0 0)";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#182e28"/></linearGradient><filter id="grain"><feTurbulence baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".075"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><g filter="url(#grain)"><path fill="url(#sky)" d="M0 0H${w}V${h}H0z"/><g transform="${transform}">${scene}</g></g></svg>`;
    await writeFile(`public/art/${id}${portrait ? "-action" : ""}.svg`, svg);
  }
}
