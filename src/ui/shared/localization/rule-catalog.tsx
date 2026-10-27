import { createContext, useContext, type ReactNode } from "react";
import { keywordText } from "../../../game/keywords";
import { renderRuleMessage, ruleMessage } from "./rule-message";

export type RuleCatalog = Readonly<Record<string, string | { source: string; text: string }>>;
const EMPTY_RULE_CATALOG: RuleCatalog = Object.freeze({});
const RuleCatalogContext = createContext<RuleCatalog>(EMPTY_RULE_CATALOG);

/** Catalog entries are complete templates keyed by their English source template. */
export function RuleCatalogProvider({ catalog, children }: { catalog: RuleCatalog; children: ReactNode }) {
  return (
    <RuleCatalogContext.Provider value={Object.keys(catalog).length ? catalog : EMPTY_RULE_CATALOG}>
      {children}
    </RuleCatalogContext.Provider>
  );
}

export function useRuleText(text: string, id?: string) {
  const catalog = useContext(RuleCatalogContext);
  if (catalog === EMPTY_RULE_CATALOG) return keywordText(text);
  const message = ruleMessage(text);
  const key = id ?? message.template;
  const entry = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  const translation =
    typeof entry === "string" ? entry : entry?.source === message.template ? entry.text : undefined;
  return renderRuleMessage(message, translation);
}
