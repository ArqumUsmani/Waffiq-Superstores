/**
 * Lenis smooth scroll, driven off GSAP's ticker so scroll-linked
 * animations and the scroll position never disagree by a frame.
 *
 * Skipped entirely under prefers-reduced-motion — native scrolling is the
 * accessible default, not a degraded one.
 */
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap-setup';
import { motion } from './motion-guard';

let lenis: Lenis | null = null;

/** Idempotent — safe under StrictMode's double-mount. */
export function initSmoothScroll(): Lenis | null {
  if (motion.reduced || lenis) return lenis;

  lenis = new Lenis({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);

  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.scrollerProxy(document.body, {
    scrollTop: (value?: number) =>
      value === undefined ? (lenis?.scroll ?? 0) : lenis?.scrollTo(value, { immediate: true }),
  });

  return lenis;
}

export const getLenis = (): Lenis | null => lenis;

/** Scrolls to a target, working whether or not Lenis is running. */
export function scrollTo(
  target: string | HTMLElement | number,
  options: Record<string, unknown> = {},
): void {
  if (lenis) {
    lenis.scrollTo(target, { offset: -90, duration: 1, ...options });
    return;
  }
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (node instanceof HTMLElement) {
    node.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth', block: 'start' });
  }
}

/**
 * Locks page scroll while a modal owns the screen.
 *
 * Counted rather than boolean: the search palette can open over the mobile
 * drawer, and a plain toggle would unlock on the first close while a modal
 * was still up.
 */
let lockCount = 0;
export function lockScroll(locked: boolean): void {
  lockCount = Math.max(0, lockCount + (locked ? 1 : -1));
  const isLocked = lockCount > 0;
  document.documentElement.classList.toggle('is-scroll-locked', isLocked);
  if (lenis) {
    if (isLocked) lenis.stop();
    else lenis.start();
  }
}
