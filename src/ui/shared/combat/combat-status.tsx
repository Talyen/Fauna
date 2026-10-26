import { EffectButton } from "../effects/treatments";
import { visualKeywords } from "../effects/palettes";
import { PagedItems } from "../navigation/pagination";
import { returnFocus } from "../navigation/focus";
import { KeywordText } from "../keyword-text";
import { motionValue } from "../motion-values";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Hourglass, Skull, Timer } from "lucide-react";
import type { CombatState } from "../../../game/types";
import { isKeywordId } from "../../../game/keywords";
import { combatStatuses, statusOrder, type Status } from "./combat-status-model";
import { KeywordIcon } from "../keyword-icon";

import { Tooltip, TooltipTrigger, TooltipContent } from "../../../components/ui/tooltip";
type AnimatedStatus = Status & { exit?: boolean; changed?: boolean };
export function CombatStatus({
  combat,
  sharedDodge = 0,
  details = false,
}: {
  combat?: CombatState;
  sharedDodge?: number;
  details?: boolean;
}) {
  const entries = combatStatuses(combat, sharedDodge);
  const root = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify(entries);
  const [shown, setShown] = useState<AnimatedStatus[]>(entries);
  useLayoutEffect(() => {
    const next = JSON.parse(signature) as Status[];
    const focused = document.activeElement as HTMLElement | null;
    if (
      root.current &&
      focused?.closest(".combat-status") === root.current &&
      !next.some((s) => s.id === focused?.dataset.statusId)
    )
      returnFocus(
        root.current?.closest(".creature-wrap")?.querySelector<HTMLElement>(".creature-card") ?? null,
      );
    // eslint-disable-next-line react/set-state-in-effect -- Return focus before replacing a focused status, while retaining outgoing chips for animation
    setShown((old) =>
      [
        ...next.map((item) => ({
          ...item,
          changed: old.some((p) => p.id === item.id && !p.exit && (p.count !== item.count || p.changed)),
        })),
        ...old
          .filter(
            (item) =>
              !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
              !next.some((n) => n.id === item.id),
          )
          .map((item) => ({ ...item, exit: true })),
      ].sort((a, b) => statusOrder.indexOf(a.id) - statusOrder.indexOf(b.id)),
    );
  }, [signature]);
  useEffect(() => {
    if (!shown.some((s) => s.exit)) return;
    const timer = setTimeout(
      () => setShown((items) => items.filter((s) => !s.exit)),
      motionValue("--motion-fast"),
    );
    return () => clearTimeout(timer);
  }, [shown]);
  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (motion?.matches) setShown((items) => items.filter((item) => !item.exit));
    };
    motion?.addEventListener?.("change", change);
    return () => motion?.removeEventListener?.("change", change);
  }, []);
  if (details)
    return (
      <div className="combat-status-details">
        {entries.map((s) => (
          <p key={s.id}>
            <KeywordText text={s.text} />
          </p>
        ))}
      </div>
    );
  if (!shown.length) return null;
  const tile = (s: AnimatedStatus) => {
    const Icon = s.id === "grace" ? Skull : s.id === "cooldown" ? Timer : Hourglass;
    return (
      <Tooltip key={s.id}>
        <TooltipTrigger asChild>
          <EffectButton
            effectKeywords={
              s.id === "controlled" && combat?.controlled
                ? [combat.controlled]
                : isKeywordId(s.id)
                  ? [s.id]
                  : visualKeywords(s.text)
            }
            effectTone={s.id === "grace" ? "death" : undefined}
            variant="ghost"
            size="icon"
            className="status-icon"
            data-status-id={s.id}
            aria-label={s.text}
            aria-hidden={s.exit || undefined}
            disabled={s.exit}
            data-exiting={s.exit || undefined}
            data-keyword={s.id}
          >
            <span
              data-keyword={s.id}
              key={s.count}
              className={s.exit ? undefined : s.changed ? "status-changed" : "status-enter"}
            >
              {s.id === "nullifyFreeze" ? (
                <KeywordIcon id="nullify" />
              ) : s.id === "reflectBurn" ? (
                <KeywordIcon id="reflect" />
              ) : isKeywordId(s.id) ? (
                <KeywordIcon id={s.id} />
              ) : (
                <Icon aria-hidden="true" />
              )}
            </span>
          </EffectButton>
        </TooltipTrigger>
        <TooltipContent>
          <KeywordText text={s.text} />
        </TooltipContent>
      </Tooltip>
    );
  };
  return (
    <div ref={root} className="combat-status" aria-label="Combat effects">
      {shown.length > 3 ? (
        <PagedItems items={shown} pageSize={1} className="combat-effect-page" label="Combat effect pages">
          {tile}
        </PagedItems>
      ) : (
        shown.map(tile)
      )}
    </div>
  );
}
