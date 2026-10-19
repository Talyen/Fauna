import { forwardRef } from "react";
import { Button, type ButtonProps } from "../components/ui/button";
import { cn } from "../lib/utils";

type ArtCardProps = Omit<ButtonProps, "children" | "variant" | "size"> & {
  artwork: string;
  aspect: "creature" | "action";
  presentation?: boolean;
};

/** The single artwork surface: one uncropped image, with state outside the art. */
export const ArtCard = forwardRef<HTMLButtonElement, ArtCardProps>(function ArtCard(
  { artwork, aspect, presentation = false, className, ...props },
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
  const classes = cn(`${aspect}-card`, className);
  if (presentation)
    return (
      <div className={classes} role="img" aria-label={props["aria-label"]}>
        {image}
      </div>
    );
  return (
    <Button ref={ref} {...props} variant="art" size="card" className={classes}>
      {image}
    </Button>
  );
});
