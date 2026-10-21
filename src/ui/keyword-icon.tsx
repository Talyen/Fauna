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
  HeartPlus,
  Sprout,
  Wind,
  Shell,
  Droplets,
  Sparkles,
  Eraser,
} from "lucide-react";
import type { KeywordId } from "../game/keywords";
const icons = {
  physical: Swords,
  fire: Flame,
  ice: Snowflake,
  lightning: Zap,
  poison: FlaskConical,
  nature: Leaf,
  light: Sun,
  health: Heart,
  mana: Gem,
  block: Shield,
  heal: HeartPlus,
  thorns: Sprout,
  dodge: Wind,
  armor: Shell,
  burn: Flame,
  freeze: Snowflake,
  bleed: Droplets,
  stun: Zap,
  leech: Heart,
  cleanse: Sparkles,
  purge: Eraser,
};
export function KeywordIcon({ id, className }: { id: KeywordId; className?: string }) {
  const Icon = icons[id as keyof typeof icons] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
