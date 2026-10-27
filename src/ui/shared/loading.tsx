import { useMessages } from "./localization/message-context";
import { motionValue } from "./motion-values";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
/** Delay only the indicator; callers render ready content immediately. */
export function Loading() {
  const i18n = useMessages();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), motionValue("--motion-loading-delay"));
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <span className="ui-loading" role="status">
      <LoaderCircle className="ui-spinner" aria-hidden="true" />
      {i18n.message("common.loading", "Loading…")}
    </span>
  ) : null;
}
