import { useCallback, useEffect, useState } from "react";
import { readPreference, writePreference } from "../../platform/preferences";
import { TEXT_SCALES } from "./settings";

function textScale(key: string) {
  const value = Number(readPreference(key) ?? "1");
  return TEXT_SCALES.some((scale) => scale === value) ? value : 1;
}

export function useDisplayPreferences() {
  const [scale, setScale] = useState(() => textScale("fauna.text-scale"));
  const [tooltipScale, setTooltipScale] = useState(() => textScale("fauna.tooltip-scale"));
  const [autoEndTurn, updateAutoEndTurn] = useState(
    () => (readPreference("fauna.auto-end-turn") ?? "true") !== "false",
  );
  useEffect(() => {
    document.documentElement.style.setProperty("--tooltip-scale", String(tooltipScale));
    writePreference("fauna.tooltip-scale", String(tooltipScale));
  }, [tooltipScale]);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(scale));
    writePreference("fauna.text-scale", String(scale));
  }, [scale]);
  const setAutoEndTurn = useCallback((value: boolean) => {
    updateAutoEndTurn(value);
    writePreference("fauna.auto-end-turn", String(value));
  }, []);
  return { scale, setScale, tooltipScale, setTooltipScale, autoEndTurn, setAutoEndTurn };
}
