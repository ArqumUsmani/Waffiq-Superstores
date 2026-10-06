/**
 * Party poppers for a placed order: one pops up at each bottom corner and
 * throws confetti across the screen.
 *
 * Plain DOM pieces moved by GSAP — no canvas, no library — and gone from the
 * page two and a half seconds later. Purely decorative: hidden from
 * assistive tech, never in the way of a click, and skipped entirely —
 * sound included — under reduced motion. Plays once per order, so reloading the confirmation page
 * does not set it off again.
 */
import { useEffect, useRef } from 'react';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { popper as popperSound } from '../lib/sfx';

const COLOURS = ['#136f37', '#b4e04b', '#d9f27a', '#f3f8ec', '#0a4527', '#f2c94c'];
const PER_SIDE = 46;

const seenKey = (id: string) => `wafiq:celebrated:${id}`;

export function PartyPoppers({ id }: { id: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || motion.reduced) return undefined;
    try {
      if (sessionStorage.getItem(seenKey(id))) return undefined;
    } catch {
      /* no storage — it just plays on every visit */
    }

    /* The page's width, not the window's: the scrollbar would clip the right-hand popper. */
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const made: HTMLElement[] = [];
    const tl = gsap.timeline({ delay: 0.25 });

    /* With the pop itself, not when the poppers start rising. Silent if the
       visitor has muted the site. */
    tl.add(() => popperSound(), 0.36);

    for (const side of [-1, 1] as const) {
      const originX = side === -1 ? 34 : vw - 34;
      const originY = vh - 40;

      const popper = document.createElement('span');
      popper.className = 'popper';
      popper.textContent = '🎉';
      host.append(popper);
      made.push(popper);
      /* The emoji's cone opens to the upper right; the right-hand one is flipped to face in. */
      gsap.set(popper, { x: originX - 28, y: vh + 20, scaleX: side === -1 ? 1 : -1, transformOrigin: '50% 100%' });
      tl.to(popper, { y: originY - 40, duration: 0.35, ease: 'back.out(2)' }, 0)
        .to(popper, { scaleY: 0.82, duration: 0.08, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.36)
        .to(popper, { y: vh + 40, duration: 0.4, ease: 'power2.in' }, 1.5);

      for (let i = 0; i < PER_SIDE; i += 1) {
        const piece = document.createElement('span');
        piece.className = `popper__bit${i % 3 === 0 ? ' popper__bit--round' : i % 3 === 1 ? ' popper__bit--strip' : ''}`;
        piece.style.background = COLOURS[i % COLOURS.length]!;
        host.append(piece);
        made.push(piece);

        /* Thrown up and inward: a fan from steep to shallow. */
        const angle = gsap.utils.random(20, 78) * (Math.PI / 180);
        const reach = gsap.utils.random(0.25, 0.95) * Math.min(vw * 0.62, 900);
        const peakX = originX - side * Math.cos(angle) * reach;
        const peakY = originY - Math.sin(angle) * gsap.utils.random(0.45, 0.95) * vh;
        const up = gsap.utils.random(0.45, 0.7);
        const fall = gsap.utils.random(1.1, 1.6);
        const at = 0.38 + gsap.utils.random(0, 0.12);

        gsap.set(piece, { x: originX, y: originY - 30, opacity: 0, rotation: gsap.utils.random(0, 360) });
        tl.set(piece, { opacity: 1 }, at)
          .to(piece, { x: peakX, duration: up, ease: 'power3.out' }, at)
          .to(piece, { y: peakY, duration: up, ease: 'power3.out' }, at)
          /* Then it flutters down, drifting on a little. */
          .to(piece, { x: peakX - side * gsap.utils.random(10, 90), duration: fall, ease: 'sine.inOut' }, at + up)
          .to(piece, { y: peakY + gsap.utils.random(0.35, 0.7) * vh, duration: fall, ease: 'power1.in' }, at + up)
          .to(piece, { rotation: `+=${gsap.utils.random(-720, 720)}`, rotationX: gsap.utils.random(360, 1080), duration: up + fall, ease: 'none' }, at)
          .to(piece, { opacity: 0, duration: 0.4 }, at + up + fall - 0.4);
      }
    }

    /* Marked a moment in, not at once: React's StrictMode mounts twice in
       development, and the first pass must not use the show up. */
    const mark = window.setTimeout(() => {
      try {
        sessionStorage.setItem(seenKey(id), '1');
      } catch {
        /* see above */
      }
    }, 600);

    return () => {
      window.clearTimeout(mark);
      tl.kill();
      made.forEach((node) => node.remove());
    };
  }, [id]);

  return <div className="poppers" ref={hostRef} aria-hidden="true" />;
}
