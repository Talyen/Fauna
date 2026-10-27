import { createContext, useContext, type ReactNode } from "react";
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
  return (
    <MessageContext.Provider value={createMessageReader(locale, catalog)}>{children}</MessageContext.Provider>
  );
}

export function useMessages() {
  return useContext(MessageContext);
}
