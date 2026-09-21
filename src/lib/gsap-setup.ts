/**
 * One place where GSAP is registered and given house defaults.
 *
 * Every module imports gsap **from here**, never from 'gsap' directly — the
 * defaults below are load-bearing and a great many tweens in this codebase
 * omit both ease and duration. A direct import silently gets GSAP's stock
 * 0.5s / power1.out instead, which looks subtly wrong and throws no error.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

/* useGSAP is registered so its contextSafe() wrapper behaves. */
gsap.registerPlugin(ScrollTrigger, useGSAP);

gsap.defaults({ ease: 'power3.out', duration: 0.8 });

ScrollTrigger.config({ ignoreMobileResize: true });

/** Pinned scenes measure wrong until fonts settle; recalc once they land. */
if (document.fonts?.ready) {
  void document.fonts.ready.then(() => ScrollTrigger.refresh());
}

export { gsap, ScrollTrigger };
