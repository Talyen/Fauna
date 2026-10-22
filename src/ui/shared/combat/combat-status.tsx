import { PagedItems } from "../navigation/pagination";
import { returnFocus } from "../navigation/focus";
import { KeywordText } from "../keyword-text";
import { motionValue } from "../motion-values";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Hourglass, Skull, Timer } from "lucide-react";
import type { CombatState } from "../../../game/types";
import { isKeywordId, KEYWORD_DEFINITIONS } from "../../../game/keywords";
import { KeywordIcon } from "../keyword-icon";
import { Button } from "../../../components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../components/ui/tooltip";
const stats = [
  "armor",
  "thorns",
  "waterThorns",
  "dodge",
  "burn",
  "poison",
  "bleed",
  "stun",
  "freeze",
] as const;
const statusOrder: readonly string[] = [
  ...stats,
  "controlled",
  "cooldown",
  "grace",
  "rhythm",
  "nextPhysical",
  "partingCut",
  "riposte",
  "freeNature",
  "freeLight",
  "freeCard",
  "reflect",
  "reflectBurn",
  "nullify",
  "nullifyFreeze",
  "blind",
];
type Status = { id: string; text: string; count: number; exit?: boolean; changed?: boolean };
export function combatStatuses(combat?: CombatState, sharedDodge = 0): Status[] {
  const dodge = Number(((combat?.dodge ?? 0) + (combat?.temporaryDodge ?? 0) + sharedDodge).toFixed(2));
  const entries: Status[] = combat
    ? stats
        .filter((id) => (id === "dodge" ? dodge : combat[id]) > 0)
        .map((id) => ({
          id,
          count: id === "dodge" ? dodge : combat[id],
          text: `${KEYWORD_DEFINITIONS[id].label} ${id === "dodge" ? dodge : combat[id]}${id === "dodge" ? "% bonus" : ""}; ${KEYWORD_DEFINITIONS[id].description}${id === "dodge" && combat.temporaryDodge ? `; ${combat.temporaryDodge}% expires at your next turn` : ""}${id === "dodge" && sharedDodge ? `; ${Number(sharedDodge.toFixed(2))}% from Shifting Sands` : ""}`,
        }))
    : [];
  if (combat?.controlled || combat?.skipped)
    entries.push({
      id: "controlled",
      count: combat.controlTurns || 1,
      text: combat.controlled
        ? `${combat.controlled === "freeze" ? "Frozen" : "Stunned"}: ${combat.controlTurns || 1} turn${combat.controlTurns > 1 ? "s" : ""}`
        : "Turn skipped",
    });
  if (combat?.cooldown)
    entries.push({ id: "cooldown", count: combat.cooldown, text: `Control immunity ${combat.cooldown}` });
  if (combat?.grace) entries.push({ id: "grace", count: combat.grace, text: `Death's Door ${combat.grace}` });
  if (combat) {
    const pending = [
      ["rhythm", combat.rhythm, `Finding Rhythm: +${combat.rhythm}% Dodge chance`],
      [
        "nextPhysical",
        combat.nextPhysical,
        `Open Flank: next attack deals ${combat.nextPhysical} additional Physical damage`,
      ],
      [
        "partingCut",
        Number(combat.partingCut),
        "Parting Cut: next Physical hit deals half its damage as additional Bleed damage",
      ],
      ["riposte", Number(combat.riposte), "Riposte: next Physical attack is a guaranteed Critical Hit"],
      ["freeNature", Number(combat.freeNature), "Windstep: next Nature card is free"],
      ["freeLight", Number(combat.freeLight), "Divine Favor: next Light card is free"],
      ["freeCard", Number(combat.freeCard), "Free Follow-up: next card is free"],
      ["blind", Number(combat.blind), `Blind: ${KEYWORD_DEFINITIONS.blind.description}`],
      [
        "nullifyFreeze",
        Number(combat.nullifyFreeze),
        "Nullify the next Freeze damage; Lasts until consumed or Purged; Does not stack",
      ],
      ["nullify", Number(combat.nullify), `Nullify: ${KEYWORD_DEFINITIONS.nullify.description}`],
      [
        "reflectBurn",
        Number(combat.reflectBurn),
        "Reflect the next Burn; Direct damage still lands; Lasts until consumed or Purged; Does not stack",
      ],
      ["reflect", Number(combat.reflect), `Reflect: ${KEYWORD_DEFINITIONS.reflect.description}`],
    ] as const;
    for (const [id, count, text] of pending) if (count) entries.push({ id, count, text });
  }
  return entries;
}
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
  const [shown, setShown] = useState(entries);
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
  const tile = (s: Status) => {
    const Icon = s.id === "grace" ? Skull : s.id === "cooldown" ? Timer : Hourglass;
    return (
      <Tooltip key={s.id}>
        <TooltipTrigger asChild>
          <Button
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
          </Button>
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
