/** Keep values and keyword identities separate from the complete English template. */
export function ruleTemplate(parts) {
  const values = {};
  const keywords = {};
  let valueIndex = 0;
  let keywordIndex = 0;
  const template = parts
    .map((part) => {
      if (part.keyword) {
        const name = `keyword${keywordIndex++}`;
        keywords[name] = part.keyword;
        return `<${name}>${part.text}</${name}>`;
      }
      return part.text.replace(/\d+(?:\.\d+)?/g, (value) => {
        const name = `value${valueIndex++}`;
        values[name] = value;
        return `{{${name}}}`;
      });
    })
    .join("");
  return { template, values, keywords };
}
