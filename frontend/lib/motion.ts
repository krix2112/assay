/**
 * Assay motion system — one easing set, three durations.
 * Import from here everywhere; do not hard-code animation values inline.
 */

// Durations in milliseconds
export const DURATION = {
  /** Very fast: icon swap, focus ring */
  fast: 120,
  /** Standard: most UI transitions */
  base: 220,
  /** Deliberate: chart enter, date-change layout */
  slow: 400,
} as const;

// Easing curves (CSS string for transitions, array for Framer/motion)
export const EASE = {
  /** Smooth deceleration — layout, reveals */
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Spring-like pop — stamps, score count-up */
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  /** Linear — crosshair, scrubber needle */
  linear: [0, 0, 1, 1] as [number, number, number, number],
} as const;

// CSS cubic-bezier strings (for plain CSS transitions)
export const EASE_CSS = {
  out: `cubic-bezier(${EASE.out.join(",")})`,
  spring: `cubic-bezier(${EASE.spring.join(",")})`,
  linear: `linear`,
} as const;

// Framer Motion / motion transition presets
export const TRANSITION = {
  fast: { duration: DURATION.fast / 1000, ease: EASE.out },
  base: { duration: DURATION.base / 1000, ease: EASE.out },
  slow: { duration: DURATION.slow / 1000, ease: EASE.out },
  springSnap: { type: "spring" as const, stiffness: 260, damping: 22 },
} as const;
