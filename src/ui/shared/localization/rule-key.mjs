/** Stable identifier for one complete English rule template, independent of values. */
export function cardRuleVariantId(cardId, template) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < template.length; index++) {
    hash ^= BigInt(template.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `content.card.${cardId}.v${hash.toString(16).padStart(16, "0")}.rule`;
}
