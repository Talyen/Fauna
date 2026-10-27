import { useMessages } from "../shared/localization/message-context";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import type { BOONS } from "../../game/content";
import { ArtCard } from "../shared/cards/art-card";
import { assetUrl } from "../shared/assets";
import { ShineText } from "../shared/effects/treatments";
import { visualKeywords } from "../shared/effects/palettes";
import { KeywordText } from "../shared/keyword-text";

type Boon = (typeof BOONS)[number];
type BoonArtProps = Omit<ComponentPropsWithoutRef<typeof ArtCard>, "aspect" | "artwork" | "effectText"> & {
  boon: Boon;
};

export const BoonArt = forwardRef<HTMLButtonElement, BoonArtProps>(function BoonArt({ boon, ...props }, ref) {
  return (
    <ArtCard
      ref={ref}
      aspect="action"
      artwork={assetUrl(`boon.${boon.id}`)}
      effectText={boon.text}
      {...props}
    />
  );
});

export function BoonName({ boon }: { boon: Boon }) {
  const i18n = useMessages();
  return (
    <ShineText keywords={visualKeywords(boon.text)}>
      {i18n.content(`content.boon.${boon.id}.name`, boon.name)}
    </ShineText>
  );
}

export function BoonText({ boon }: { boon: Boon }) {
  return (
    <p>
      <KeywordText text={boon.text} id={`content.boon.${boon.id}.rule`} />
    </p>
  );
}
