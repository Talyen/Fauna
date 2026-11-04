import sharp from "sharp";

// 720 CSS px at 2x or 480 CSS px at 3x; ArtCard also bounds rendering by
// the actual prepared dimensions, including hover. Never invent pixels.
export const CARD_RECIPE = Object.freeze({
  version: 2,
  maxCssLongEdge: 480,
  pixelRatio: 3,
  longEdge: 1440,
  fit: "inside",
  withoutEnlargement: true,
  format: "webp",
  lossless: true,
  effort: 4,
});

export function recipeSettings(entry) {
  return entry.recipe === "card-webp"
    ? { ...CARD_RECIPE, encoder: sharp.versions }
    : { version: 1, mode: "copy" };
}

export async function rasterMetadata(bytes, extension) {
  // stats() forces a full decode; metadata alone would accept truncated pixels.
  const image = sharp(bytes, { failOn: "warning" });
  const metadata = await image.metadata();
  const format = extension === ".jpg" ? "jpeg" : extension.slice(1);
  if (![".png", ".webp", ".jpg", ".jpeg"].includes(extension) || metadata.format !== format)
    throw new Error(`Unsupported or corrupt image ${extension}`);
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
