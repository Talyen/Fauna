import { createContext, useContext, type ReactNode } from "react";
import { keywordText } from "../../../game/keywords";
import { renderRuleMessage, ruleMessage } from "./rule-message";

export type RuleCatalog = Readonly<Record<string, string>>;
const EMPTY_RULE_CATALOG: RuleCatalog = Object.freeze({});
const RuleCatalogContext = createContext<RuleCatalog>(EMPTY_RULE_CATALOG);

/** Catalog entries are complete templates keyed by their English source template. */
export function RuleCatalogProvider({ catalog, children }: { catalog: RuleCatalog; children: ReactNode }) {
  return <RuleCatalogContext.Provider value={catalog}>{children}</RuleCatalogContext.Provider>;
}

export function useRuleText(text: string) {
  const catalog = useContext(RuleCatalogContext);
  if (catalog === EMPTY_RULE_CATALOG) return keywordText(text);
  const message = ruleMessage(text);
  const translation = Object.hasOwn(catalog, message.template) ? catalog[message.template] : undefined;
  return renderRuleMessage(message, translation);
}
