function templateHash(template) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < template.length; index++) {
    hash ^= BigInt(template.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

/** Stable identifiers retain one complete English template independently of its values. */
export function cardRuleVariantId(cardId, template) {
  return `content.card.${cardId}.v${templateHash(template)}.rule`;
}
export function statusRuleVariantId(statusId, template) {
  return `content.status.${statusId}.v${templateHash(template)}.rule`;
}
