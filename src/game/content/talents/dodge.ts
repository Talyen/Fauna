import { talent } from "../talent-builder";
export const DODGE_TALENTS = [
  talent("dodge.lightfoot", "Lightfoot", 0),
  talent("dodge.catch-breath", "Catch Breath", 0),
  talent("dodge.thornstep", "Thornstep", 1),
  talent("dodge.clean-getaway", "Clean Getaway", 1),
  talent("dodge.open-flank", "Open Flank", 2),
  talent("dodge.unburdened", "Unburdened", 2),
  talent("dodge.tailwind", "Tailwind", 3),
  talent("dodge.finding-rhythm", "Finding Rhythm", 3),
  talent("dodge.perfect-timing", "Perfect Timing", 4),
] as const;
