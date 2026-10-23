import { useId, type CSSProperties, type ReactNode, type Ref } from "react";
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
  const backgroundImage = shineGradient(keywords, tone);
  return (
    <span className="effect-shine-text" style={{ backgroundImage }}>
      {children}
    </span>
  );
}
function shineGradient(keywords: readonly KeywordId[], tone?: EffectTone) {
  const palette = effectPalette(keywords, tone);
  const band = `${palette.text.join(",")}, var(--effect-highlight)`;
  return `linear-gradient(in oklab 90deg, ${band}, ${band}, ${palette.text[0]})`;
}

/** Paint the icon mask with the same CSS gradient and motion policy as short labels. */
export function ShineIcon({
  children,
  keywords = [],
}: {
  children: ReactNode;
  keywords?: readonly KeywordId[];
}) {
  const mask = useId();
  return (
    <svg className="effect-shine-icon" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <g color="var(--effect-highlight)">{children}</g>
        </mask>
      </defs>
      <foreignObject width="24" height="24" mask={`url(#${mask})`}>
        <div
          className="effect-shine-text effect-shine-icon-fill"
          style={{ backgroundImage: shineGradient(keywords) }}
        />
      </foreignObject>
    </svg>
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
