import { forwardRef } from "react";
import { Button, type ButtonProps } from "../../../components/ui/button";
import type { KeywordId } from "../../../game/keywords";
import { effectPalette, visualKeywords, type EffectTone } from "../effects/palettes";
import { useEffectMetadata } from "../effects/effects";
import { ShineBorder } from "../effects/treatments";
import { cn } from "../../../lib/utils";
import type { CombatState } from "../../../game/types";
import { ControlArtEffect } from "./control-art-effect";
type ArtCardProps = Omit<ButtonProps, "children" | "variant" | "size"> & {
  artwork: string;
  aspect: "creature" | "action";
  presentation?: boolean;
  effectText?: string;
  effectKeywords?: readonly KeywordId[];
  effectTone?: EffectTone;
  urgent?: boolean;
  acting?: boolean;
  control?: CombatState["controlled"];
};

/** The single uncropped artwork surface; control decoration never replaces external rules. */
export const ArtCard = forwardRef<HTMLButtonElement, ArtCardProps>(function ArtCard(
  {
    artwork,
    aspect,
    presentation = false,
    className,
    effectText,
    effectKeywords,
    effectTone,
    urgent = false,
    acting = false,
    control = null,
    ...props
  },
  ref,
) {
  const image = (
    <img
      src={artwork}
      width={aspect === "creature" ? 800 : 600}
      height={aspect === "creature" ? 600 : 800}
      alt=""
      draggable={false}
    />
  );
  const keywords = effectKeywords ?? (effectText === undefined ? undefined : visualKeywords(effectText));
  const metadata = useEffectMetadata(keywords, effectTone);
  const palette = effectPalette(keywords, urgent ? "death" : effectTone);
  const shine =
    keywords !== undefined || effectTone ? (
      <ShineBorder
        colors={palette.border}
        duration={urgent || acting ? 4 : 14}
        width={urgent || acting ? 3 : 2}
      />
    ) : null;
  const classes = cn(`${aspect}-card`, className);
  if (presentation)
    return (
      <div
        className={classes}
        role="img"
        aria-label={props["aria-label"]}
        tabIndex={props.tabIndex}
        {...metadata}
      >
        {image}
        {shine}
        <ControlArtEffect kind={aspect === "creature" ? control : null} />
      </div>
    );
  return (
    <Button
      ref={ref}
      {...props}
      {...metadata}
      data-art-keyword={keywords?.[0]}
      data-effect-art={keywords !== undefined || undefined}
      data-effect-urgent={urgent || undefined}
      data-effect-acting={acting || undefined}
      variant="art"
      size="card"
      className={classes}
    >
      {image}
      {shine}
      <ControlArtEffect kind={aspect === "creature" ? control : null} />
    </Button>
  );
});
