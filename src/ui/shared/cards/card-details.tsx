import { useMessages } from "../localization/message-context";
import { Sparkles } from "lucide-react";
import { ShineIcon, ShineText } from "../effects/treatments";
import { visualKeywords } from "../effects/palettes";
import { creaturePassive } from "../../../game/progression";
import { KeywordText } from "../keyword-text";
import { species, type SpeciesId } from "../../../game/content";
import { cardCost } from "../../../game/ability-rules";
import type { Creature, Card, GameState } from "../../../game/types";
import { CardRules } from "../combat/combat-values";
import { actionDisplay } from "./action-display";
export function ActionDetails({
  card,
  ownerName,
  actor,
  modifiers,
  compact = false,
}: {
  card: Card;
  compact?: boolean;
  ownerName: string;
  actor?: Creature;
  modifiers?: GameState;
}) {
  const i18n = useMessages();
  const { def, value } = actionDisplay(card, actor, modifiers);
  return (
    <div className="card-details">
      <strong>
        {i18n.content(`content.card.${def.id}.name`, def.name)}
        {card.level ? ` +${card.level}` : ""}
      </strong>
      {compact ? null : (
        <p>
          <KeywordText text={`${ownerName} · ${modifiers ? cardCost(card, modifiers) : def.cost} mana`} />
        </p>
      )}
      {card.temporary && !def.consume ? (
        <p>{i18n.message("card.copy", "Copy · Lasts for this battle")}</p>
      ) : null}
      <CardRules card={def} modifiers={modifiers} level={card.level} value={value} />
    </div>
  );
}
export function CreatureDetails({
  progression,
  kind,
  name,
}: {
  kind: SpeciesId;
  progression?: Pick<GameState, "discovery">;
  name?: string;
}) {
  const i18n = useMessages();
  const info = species(kind);
  const passive = creaturePassive(progression, kind);
  const keywords = visualKeywords(passive.description);
  return (
    <div className="card-details">
      <strong>
        {!name || name === info.name ? i18n.content(`content.species.${kind}.name`, info.name) : name}
      </strong>
      <div className="creature-trait-name">
        <ShineIcon keywords={keywords}>
          <Sparkles />
        </ShineIcon>
        <strong>
          <ShineText keywords={keywords}>
            {i18n.content(`content.species.${kind}.trait`, info.trait)}
          </ShineText>
        </strong>
      </div>
      <p>
        <KeywordText text={passive.description} id={`content.species.${kind}.passive.${passive.rank}.rule`} />
      </p>
    </div>
  );
}
