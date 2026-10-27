import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createMessageReader, type MessageCatalog } from "./messages";

const english = createMessageReader("en", {});
const MessageContext = createContext(english);

export function MessageProvider({
  locale,
  catalog,
  children,
}: {
  locale: string;
  catalog: MessageCatalog;
  children: ReactNode;
}) {
  const reader = useMemo(() => createMessageReader(locale, catalog), [locale, catalog]);
  return <MessageContext.Provider value={reader}>{children}</MessageContext.Provider>;
}

export function useMessages() {
  return useContext(MessageContext);
}
