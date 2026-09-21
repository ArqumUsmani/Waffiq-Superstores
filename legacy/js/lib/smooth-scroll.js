/**
 * Lenis smooth scroll, driven off GSAP's ticker so scroll-linked
 * animations and the scroll position never disagree by a frame.
 *
 * Skipped entirely under prefers-reduced-motion — native scrolling is
 * the accessible default, not a degraded one.
 */
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap-setup.js';
import { motion } from './motion-guard.js';

let lenis = null;

export function initSmoothScroll() {
  if (motion.reduced || lenis) return lenis;

  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);

  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.scrollerProxy(document.body, {
    scrollTop: (value) =>
      value === undefined ? lenis.scroll : lenis.scrollTo(value, { immediate: true }),
  });

  return lenis;
}

export const getLenis = () => lenis;

/** Scrolls to a target, working whether or not Lenis is running. */
export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset: -90, duration: 1, ...options });
    return;
  }
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  node?.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth', block: 'start' });
}

/** Locks page scroll while a modal owns the screen. */
export function lockScroll(locked) {
  document.documentElement.classList.toggle('is-scroll-locked', locked);
  if (lenis) locked ? lenis.stop() : lenis.start();
}
