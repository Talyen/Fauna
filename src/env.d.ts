declare const __FAUNA_BUILD__: string;
declare const __FAUNA_QUIET_PREVIEW__: boolean;
declare module "*.json?fauna-runtime" {
  const catalog: Record<
    string,
    | { source: string; text: string }
    | { source: { one: string; other: string }; forms: Partial<Record<Intl.LDMLPluralRule, string>> }
  >;
  export default catalog;
}
