import { forwardRef, type CSSProperties } from "react";
import { Button, type ButtonProps } from "../../../components/ui/button";
import type { KeywordId } from "../../../game/keywords";
import { effectPalette, visualKeywords, type EffectTone } from "../effects/palettes";
import { useEffectMetadata } from "../effects/effects";
import { ShineBorder } from "../effects/treatments";
import { cn } from "../../../lib/utils";
import type { CombatState } from "../../../game/types";
import { ControlArtEffect } from "./control-art-effect";
import { artworkWidth } from "../assets";
type ArtCardProps = Omit<ButtonProps, "children" | "variant" | "size"> & {
  artwork: string;
  artworkSlices?: readonly string[];
  allowUpscaling?: boolean;
  aspect: "creature" | "action";
  presentation?: boolean;
  shine?: boolean;
  hoverShimmer?: boolean;
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
    artworkSlices,
    allowUpscaling = false,
    aspect,
    presentation = false,
    shine: showShine = true,
    hoverShimmer = false,
    className,
    effectText,
    effectKeywords,
    effectTone,
    urgent = false,
    acting = false,
    control = null,
    style,
    ...props
  },
  ref,
) {
  const rasterWidths = (artworkSlices?.length ? artworkSlices : [artwork])
    .map((url) => artworkWidth(url, aspect))
    .filter((width) => width !== undefined);
  const pixelWidth = rasterWidths.length ? Math.min(...rasterWidths) : undefined;
  const artworkStyle =
    !allowUpscaling && pixelWidth
      ? ({
          ...style,
          "--artwork-max-width": `calc(${pixelWidth}px / var(--artwork-pixel-ratio, 2) / var(--hover-scale) / var(--artwork-motion-scale, 1))`,
        } as CSSProperties)
      : style;
  const image =
    artworkSlices && artworkSlices.length > 1 ? (
      <span className="art-slices" data-slices={artworkSlices.length} aria-hidden="true">
        {artworkSlices.map((slice) => (
          <img key={slice} src={slice} alt="" draggable={false} />
        ))}
      </span>
    ) : (
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
    showShine && (keywords !== undefined || effectTone) ? (
      <ShineBorder colors={palette.border} duration={urgent || acting ? 4 : 14} />
    ) : null;
  const classes = cn(`${aspect}-card`, className);
  if (presentation)
    return (
      <div
        className={classes}
        role="img"
        aria-label={props["aria-label"]}
        tabIndex={props.tabIndex}
        style={artworkStyle}
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
      style={artworkStyle}
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
      {hoverShimmer ? <span className="art-hover-shimmer" aria-hidden="true" /> : null}
      <ControlArtEffect kind={aspect === "creature" ? control : null} />
    </Button>
  );
});
