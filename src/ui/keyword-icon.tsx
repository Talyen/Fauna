import {
  Swords,
  Flame,
  Snowflake,
  Zap,
  FlaskConical,
  Leaf,
  Sun,
  Heart,
  Gem,
  Shield,
  Sprout,
  Wind,
  Shell,
  Droplets,
  Sparkles,
  Eraser,
  EyeOff,
} from "lucide-react";
import type { KeywordId } from "../game/keywords";
const icons = {
  physical: Swords,
  poison: FlaskConical,
  nature: Leaf,
  water: Droplets,
  waterThorns: Droplets,
  light: Sun,
  health: Heart,
  mana: Gem,
  block: Shield,
  thorns: Sprout,
  dodge: Wind,
  blind: EyeOff,
  armor: Shell,
  burn: Flame,
  freeze: Snowflake,
  bleed: Droplets,
  stun: Zap,
  leech: Heart,
  cleanse: Sparkles,
  purge: Eraser,
  reflect: Shield,
  nullify: Shield,
};
export function KeywordIcon({ id, className }: { id: KeywordId; className?: string }) {
  const Icon = icons[id as keyof typeof icons] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
