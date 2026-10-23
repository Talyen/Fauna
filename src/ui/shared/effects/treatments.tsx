import type { CSSProperties, ReactNode, Ref } from "react";
import { Button, type ButtonProps } from "../../../components/ui/button";
import type { KeywordId } from "../../../game/keywords";
import { effectPalette, type EffectTone } from "./palettes";
import { useEffectMetadata } from "./effects";

export function ShineBorder({
  colors,
  duration = 14,
  width = 2,
  className = "",
}: {
  colors: readonly string[];
  duration?: number;
  width?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`effect-shine-border ${className}`}
      style={
        {
          "--shine-duration": `${duration}s`,
          "--shine-width": `${width}px`,
          backgroundImage: `radial-gradient(${colors.join(",")})`,
        } as CSSProperties
      }
    />
  );
}
export function ShineText({
  children,
  keywords = [],
  tone,
}: {
  children: ReactNode;
  keywords?: readonly KeywordId[];
  tone?: EffectTone;
}) {
  const palette = effectPalette(keywords, tone);
  const band = `${palette.text.join(",")}, var(--effect-highlight)`;
  return (
    <span
      className="effect-shine-text"
      style={{ backgroundImage: `linear-gradient(in oklab 90deg, ${band}, ${band}, ${palette.text[0]})` }}
    >
      {children}
    </span>
  );
}
export function EffectButton({
  effectKeywords,
  effectTone,
  attention = false,
  children,
  ...props
}: ButtonProps & {
  ref?: Ref<HTMLButtonElement>;
  effectKeywords?: readonly KeywordId[];
  effectTone?: EffectTone;
  attention?: boolean;
}) {
  const metadata = useEffectMetadata(effectKeywords, effectTone);
  return (
    <Button {...props} {...metadata}>
      {children}
      {attention && !props.disabled && !props["aria-disabled"] ? (
        <ShineBorder colors={effectPalette(effectKeywords, effectTone).border} duration={8} />
      ) : null}
    </Button>
  );
}
