import { type CSSProperties, type ReactNode, type Ref } from "react";
import { Button, type ButtonProps } from "../../../components/ui/button";
import type { KeywordId } from "../../../game/keywords";
import { effectPalette, type EffectTone } from "./palettes";
import { useEffectMetadata } from "./effects";

export function ShineBorder({
  colors,
  duration = 14,
  className = "",
}: {
  colors: readonly string[];
  duration?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`effect-shine-border ${className}`}
      style={
        {
          "--shine-duration": `${duration}s`,
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
  readable = false,
}: {
  children: ReactNode;
  keywords?: readonly KeywordId[];
  tone?: EffectTone;
  readable?: boolean;
}) {
  const backgroundImage = shineGradient(keywords, tone, readable);
  return (
    <span className="effect-shine-text" style={{ backgroundImage }}>
      {children}
    </span>
  );
}
function shineGradient(keywords: readonly KeywordId[], tone?: EffectTone, readable = false) {
  const palette = effectPalette(keywords, tone);
  const colors = readable
    ? palette.text.map((color) => `color-mix(in srgb, ${color} 50%, var(--effect-highlight))`)
    : palette.text;
  const band = `${colors.join(",")}, var(--effect-highlight)`;
  return `linear-gradient(in oklab 90deg, ${band}, ${band}, ${colors[0]})`;
}

export function EffectButton({
  effectKeywords,
  effectTone,
  children,
  ...props
}: ButtonProps & {
  ref?: Ref<HTMLButtonElement>;
  effectKeywords?: readonly KeywordId[];
  effectTone?: EffectTone;
}) {
  const metadata = useEffectMetadata(effectKeywords, effectTone);
  return (
    <Button {...props} {...metadata}>
      {children}
    </Button>
  );
}
