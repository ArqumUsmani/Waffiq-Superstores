/**
 * Hero gate — the real storefront, doors shut, that swings open as the
 * visitor scrolls past the hero.
 *
 * Desktop: a pinned scroll scene. The panel holds still on screen for a
 * stretch of scroll while the photo zooms in and crossfades from the
 * closed-door render to the open-door one — the zoom itself is what
 * reads as the doors swinging open, not a separate cut.
 *
 * Touch, narrow screens and reduced motion: the same beats play once,
 * without a pin or scrub — a pinned section fighting a mobile browser's
 * collapsing address bar is worse than no motion, and reduced motion
 * gets no motion at all, just the finished, doors-open state.
 */
import { el } from '../lib/dom.js';
import { gsap, ScrollTrigger } from '../lib/gsap-setup.js';
import { motion, onMotionChange } from '../lib/motion-guard.js';
import { branches } from '../lib/data.js';
import { t } from '../lib/i18n.js';
import gateClosedUrl from '../../assets/hero/gate-closed.jpg';
import gateOpenUrl from '../../assets/hero/gate-open.jpg';

export function initHeroGate(root) {
  if (!root) return () => {};

  const branch = branches[0];

  const eyebrow = el(
    'p',
    { class: 'hero-gate__eyebrow', dataset: { i18n: 'heroGate.eyebrow' } },
    t('heroGate.eyebrow'),
  );

  const closed = el('img', {
    class: 'hero-gate__img hero-gate__img--closed',
    src: gateClosedUrl,
    alt: t('heroGate.alt'),
    loading: 'lazy',
    decoding: 'async',
  });
  const open = el('img', {
    class: 'hero-gate__img hero-gate__img--open',
    src: gateOpenUrl,
    alt: '',
    'aria-hidden': 'true',
    loading: 'lazy',
    decoding: 'async',
  });
  const zoom = el('div', { class: 'hero-gate__zoom' }, closed, open);

  const caption = el(
    'div',
    { class: 'hero-gate__caption' },
    el('strong', {}, branch?.name ?? ''),
    el('span', {}, branch?.hoursSummary ?? ''),
  );

  const frame = el('div', { class: 'hero-gate__frame' }, zoom, caption);
  root.replaceChildren(el('div', { class: 'shell' }, eyebrow, frame));

  let context = null;

  /** Desktop: pinned, scrubbed to scroll position exactly. */
  const buildPinned = () => {
    context = gsap.context(() => {
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * 1.15)}`,
            pin: true,
            scrub: 0.7,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
        .fromTo(zoom, { scale: 1 }, { scale: 1.22 }, 0)
        .fromTo(closed, { opacity: 1 }, { opacity: 0 }, 0.18)
        .fromTo(open, { opacity: 0 }, { opacity: 1 }, 0.18)
        .fromTo(caption, { opacity: 0, y: 18 }, { opacity: 1, y: 0, ease: 'power2.out' }, 0.62);
    }, root);
  };

  /** Touch / narrow: the same reveal, played once, no pin. */
  const buildOnce = () => {
    gsap.set(zoom, { scale: 1 });
    gsap.set(closed, { opacity: 1 });
    gsap.set(open, { opacity: 0 });
    gsap.set(caption, { opacity: 0, y: 18 });

    context = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: root, start: 'top 75%', once: true } })
        .to(zoom, { scale: 1.08, duration: 1.4, ease: 'power2.out' }, 0)
        .to(closed, { opacity: 0, duration: 1, ease: 'power2.inOut' }, 0.35)
        .to(open, { opacity: 1, duration: 1, ease: 'power2.inOut' }, 0.35)
        .to(caption, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.9);
    }, root);
  };

  const build = () => {
    context?.revert();
    context = null;

    if (motion.reduced) {
      // The finished state, instantly — doors open, hours legible, no
      // transform left running.
      gsap.set(zoom, { scale: 1, clearProps: 'transform' });
      gsap.set(closed, { opacity: 0 });
      gsap.set(open, { opacity: 1 });
      gsap.set(caption, { opacity: 1, y: 0 });
      return;
    }

    if (motion.allowScenes) buildPinned();
    else buildOnce();
  };

  build();

  const stopWatching = onMotionChange(() => {
    build();
    ScrollTrigger.refresh();
  });

  return () => {
    stopWatching();
    context?.revert();
  };
}
