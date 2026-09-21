/** One place where GSAP is registered and given house defaults. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

gsap.defaults({ ease: 'power3.out', duration: 0.8 });

ScrollTrigger.config({ ignoreMobileResize: true });

/** Pinned scenes measure wrong until fonts settle; recalc once they land. */
if (document.fonts?.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

export { gsap, ScrollTrigger, Flip };
