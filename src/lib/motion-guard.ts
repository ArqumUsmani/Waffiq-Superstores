/**
 * Single source of truth for "may I animate this?".
 *
 * Every animated module asks here rather than reading the media query
 * itself, so turning motion off is one decision rather than twenty.
 */

export interface Motion {
  readonly reduced: boolean;
  readonly hasHover: boolean;
  readonly isWide: boolean;
  readonly allowScenes: boolean;
}

type MotionListener = (motion: Motion) => void;

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const wideQuery = window.matchMedia('(min-width: 1024px)');

const listeners = new Set<MotionListener>();

export const motion: Motion = {
  /** True when the visitor has asked the OS for less motion. */
  get reduced() {
    return reduceQuery.matches;
  },
  /** True for real pointers — gates hover-only work like the cursor. */
  get hasHover() {
    return hoverQuery.matches;
  },
  /** Desktop-width breakpoint used to gate pinned scroll scenes. */
  get isWide() {
    return wideQuery.matches;
  },
  /** Convenience: run rich motion only when it is both wanted and useful. */
  get allowScenes() {
    return !reduceQuery.matches && wideQuery.matches;
  },
};

/** Notifies subscribers when any of the three conditions flips. */
export function onMotionChange(callback: MotionListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

const broadcast = () => listeners.forEach((cb) => cb(motion));

for (const query of [reduceQuery, hoverQuery, wideQuery]) {
  query.addEventListener('change', broadcast);
}

/**
 * A value that changes whenever any of the three conditions flips, so React
 * can use it as an effect dependency via useSyncExternalStore.
 */
export const motionKey = (): string =>
  `${motion.reduced}|${motion.hasHover}|${motion.isWide}`;

/**
 * Runs `build` only when motion is allowed, and returns a teardown that
 * is safe to call whether or not it ever ran.
 */
export function whenAnimated(build: () => void | (() => void)): () => void {
  if (motion.reduced) return () => {};
  const teardown = build();
  return typeof teardown === 'function' ? teardown : () => {};
}
