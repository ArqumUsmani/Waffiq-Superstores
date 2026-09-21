import { useRef, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { useLang, useMotionKey } from '../state/app-state';

type ContextSafe = <F extends (...args: never[]) => unknown>(fn: F) => F;

export interface RigHelpers {
  /**
   * Wraps an event handler so tweens it creates land inside this rig's
   * gsap.context and get reverted with it. Any handler that creates a tween
   * must go through this, or it leaks past unmount.
   */
  contextSafe: ContextSafe;
}

/**
 * Wraps an imperative `build(root) => teardown?` rig in a React effect.
 *
 * This is the one pattern for every motion rig in the app. Notes on why it
 * is shaped this way:
 *
 * - `useGSAP` is useLayoutEffect + gsap.context() + auto-revert. Layout
 *   effect is required, not a preference: nearly every rig opens with a
 *   hidden initial state (`gsap.set(targets, {opacity: 0})`) or measures
 *   layout, and useEffect lets the browser paint one frame of the natural
 *   style first — a visible flash of un-revealed content.
 *
 * - `revertOnUpdate` is NOT the default. Without it a dependency change
 *   re-runs the body without reverting, leaving the previous language's
 *   ScrollTriggers, pin-spacers and inline styles stacked on top of the new
 *   ones. Every rig here wants full revert-then-rebuild.
 *
 * - Language and motion conditions are dependencies rather than per-rig
 *   subscriptions, so one store change rebuilds every rig consistently.
 *
 * Under StrictMode the double-invoke is mount → cleanup + revert → mount.
 * revert() restores the recorded inline styles, so the second build measures
 * a clean DOM. Anything a rig appends *outside* its scope is not covered —
 * render those as portals instead of appending them imperatively.
 */
export function useRig<T extends HTMLElement>(
  build: (root: T, helpers: RigHelpers) => void | (() => void),
  deps: unknown[] = [],
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const lang = useLang();
  const motion = useMotionKey();

  useGSAP(
    (_context, contextSafe) => {
      const root = ref.current;
      if (!root) return;
      return build(root, { contextSafe: contextSafe as ContextSafe });
    },
    {
      scope: ref,
      dependencies: [lang, motion, ...deps],
      revertOnUpdate: true,
    },
  );

  return ref;
}
