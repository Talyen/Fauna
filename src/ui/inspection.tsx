import { useState } from "react";
import { useStore } from "zustand";
import type { Session } from "../application/session";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { ActionCard, CreatureCard } from "./cards";
import { ActionDetails, CreatureDetails } from "./card-details";
import { ENCOUNTERS, definition, species } from "../game/content";
import { returnFocus } from "./focus";
import type { Inspection } from "./battle-screen";
export function Inspector({
  item,
  session,
  onClose,
}: {
  item: Inspection;
  session: Session;
  onClose: () => void;
}) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const game = useStore(session.store, (s) => s.game);
  const kind = "card" in item ? definition(item.card.definitionId).species : item.species;
  const creature = species(kind);
  const ally = game.team.find((c) => c.species === kind);
  const enemyIndex =
    "enemyId" in item && item.enemyId?.startsWith("preview-") ? Number(item.enemyId.slice(8)) : -1;
  const preview = ENCOUNTERS[game.encounter]?.enemies[enemyIndex];
  const enemy = preview
    ? { ...preview, maxHealth: preview.health, marks: 0 }
    : "enemyId" in item
      ? game.battle?.enemies.find((e) => e.id === item.enemyId)
      : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`inspection ${"card" in item ? "single-card" : ""}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus(opener);
        }}
      >
        <DialogTitle className="sr-only">
          {"card" in item
            ? `${definition(item.card.definitionId).name} details`
            : `${enemy?.name ?? creature.name} details`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {enemy ? "Enemy attack" : creature.description}
        </DialogDescription>
        {"card" in item ? (
          <>
            <ActionCard card={item.card} ownerName={creature.name} onClick={() => {}} presentation />
            <ActionDetails
              card={item.card}
              ownerName={creature.name}
              modifiers={game}
              actor={game.team.find((c) => c.id === item.card.ownerId)}
            />
            <p className="trait-description">{creature.description}</p>
          </>
        ) : (
          <>
            <CreatureCard
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? ally?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              presentation
            />
            <CreatureDetails
              kind={kind}
              name={enemy?.name}
              health={enemy?.health ?? ally?.health ?? creature.health}
              maxHealth={enemy?.maxHealth ?? creature.health}
              cards={game.cards}
              block={enemy ? 0 : ally?.block}
              marks={enemy?.marks}
              modifiers={game}
              actor={enemy ? undefined : ally}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
