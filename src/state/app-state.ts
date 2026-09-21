/**
 * React bindings for the three module-level stores.
 *
 * The stores themselves stay framework-agnostic — `t()` and `pick()` have to
 * be callable from plain modules like data.ts — so React subscribes to them
 * through useSyncExternalStore rather than owning the state.
 */
import { useSyncExternalStore } from 'react';
import { getLang, subscribeLang, type Lang } from '../lib/i18n';
import { getTheme, onThemeChange, type Theme } from '../lib/theme';
import { motionKey, onMotionChange } from '../lib/motion-guard';

/** Re-renders the caller whenever the language flips. */
export const useLang = (): Lang => useSyncExternalStore(subscribeLang, getLang, getLang);

/** Re-renders the caller whenever the theme flips. */
export const useTheme = (): Theme => useSyncExternalStore(onThemeChange, getTheme, getTheme);

/**
 * A string that changes whenever reduced-motion, hover capability or the
 * wide breakpoint flips — used as a rig dependency so scroll scenes rebuild
 * for the new conditions rather than holding stale triggers.
 */
export const useMotionKey = (): string =>
  useSyncExternalStore(onMotionChange, motionKey, motionKey);
