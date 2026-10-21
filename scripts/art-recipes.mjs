import sharp from "sharp";

// Covers the 320px hovered card long edge, 320px Collection abilities and
// inspection with headroom to 480 CSS px at 2x density. Never invent pixels.
export const CARD_RECIPE = Object.freeze({
  version: 1,
  maxCssLongEdge: 480,
  pixelRatio: 2,
  longEdge: 960,
  fit: "inside",
  withoutEnlargement: true,
  format: "webp",
  lossless: true,
  effort: 6,
});

export function recipeSettings(entry) {
  return entry.recipe === "card-webp"
    ? { ...CARD_RECIPE, encoder: sharp.versions }
    : { version: 1, mode: "copy" };
}

export async function rasterMetadata(bytes) {
  // stats() forces a full decode; metadata alone would accept truncated pixels.
  const image = sharp(bytes, { failOn: "warning" });
  const metadata = await image.metadata();
  if (metadata.pages > 1 || metadata.orientation > 1)
    throw new Error("Artwork must be a single, upright image.");
  await image.stats();
  return { width: metadata.width, height: metadata.height, alpha: metadata.hasAlpha };
}

export async function prepareBytes(entry, bytes) {
  if (entry.recipe === "copy") return bytes;
  return sharp(bytes, { failOn: "warning" })
    .resize({
      width: CARD_RECIPE.longEdge,
      height: CARD_RECIPE.longEdge,
      fit: CARD_RECIPE.fit,
      withoutEnlargement: CARD_RECIPE.withoutEnlargement,
    })
    .webp({ lossless: CARD_RECIPE.lossless, effort: CARD_RECIPE.effort })
    .toBuffer();
}
