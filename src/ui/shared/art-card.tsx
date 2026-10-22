import { forwardRef } from "react";
import { Button, type ButtonProps } from "../../components/ui/button";
import { useSurfaceRef } from "../infrastructure/surface-ref";
import { keywordText } from "../../game/keywords";
import { cn } from "../../lib/utils";
type ArtCardProps = Omit<ButtonProps, "children" | "variant" | "size"> & {
  artwork: string;
  aspect: "creature" | "action";
  presentation?: boolean;
  effectText?: string;
};

/** The single artwork surface: one uncropped image, with state outside the art. */
export const ArtCard = forwardRef<HTMLButtonElement, ArtCardProps>(function ArtCard(
  { artwork, aspect, presentation = false, className, effectText, ...props },
  ref,
) {
  const surface = useSurfaceRef<HTMLDivElement>();
  const image = (
    <img
      src={artwork}
      width={aspect === "creature" ? 800 : 600}
      height={aspect === "creature" ? 600 : 800}
      alt=""
      draggable={false}
    />
  );
  const keyword =
    effectText === undefined ? undefined : keywordText(effectText).find((part) => part.keyword)?.keyword;
  const classes = cn(`${aspect}-card`, className);
  if (presentation)
    return (
      <div ref={surface} className={classes} role="img" aria-label={props["aria-label"]}>
        {image}
      </div>
    );
  return (
    <Button
      ref={ref}
      {...props}
      data-art-keyword={keyword}
      data-effect-art={effectText !== undefined || undefined}
      variant="art"
      size="card"
      className={classes}
    >
      {image}
    </Button>
  );
});
