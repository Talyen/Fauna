export function ruleTemplate<K extends string>(
  parts: readonly { text: string; keyword?: K }[],
): {
  template: string;
  values: Record<string, string>;
  keywords: Record<string, K>;
};
