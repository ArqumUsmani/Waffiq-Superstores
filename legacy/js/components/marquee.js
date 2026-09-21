/**
 * Infinite ribbon of isometric brand packs that reverses with scroll
 * direction — riding a shallow arc rather than a flat line, rising
 * through the centre of the ribbon and settling back down at each edge.
 *
 * The track is duplicated once and translated by exactly half its width,
 * so the wrap is seamless at any speed. Under reduced motion it becomes a
 * plain, horizontally scrollable list — flat, no curve, no motion.
 */
import { $$, el, dirFactor, uniquifySvgIds } from '../lib/dom.js';
import { brandMark } from './brand-mark.js';
import { gsap, ScrollTrigger } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { allBrands } from '../lib/data.js';

// How far the ribbon's peak rises above rest, and how far each item
// leans into the climb — a gentle arc, not a full loop-the-loop.
const ARC_HEIGHT = 45;
const ARC_TILT = 6;

export function brandMarquee({ speed = 42, brands = allBrands } = {}) {
  const root = el('div', { class: 'marquee', 'aria-hidden': 'true' });
  const track = el('div', { class: 'marquee__track' });

  // Two runs make the loop wrap without a visible seam. They are built
  // separately so each copy's gradient ids stay unique — duplicated ids
  // would make the second run paint with the first run's gradients.
  const run = () =>
    brands
      .map((brand) => `<span class="marquee__item">${uniquifySvgIds(brandMark(brand))}</span>`)
      .join('');

  track.innerHTML = run() + run();
  root.append(track);

  if (motion.reduced) {
    root.classList.add('is-static');
    return root;
  }

  // Real brand logos are plain <img>s with no width attribute (their
  // aspect ratio is not known up front), so they lay out at whatever
  // placeholder size the browser guesses until each has decoded — one
  // requestAnimationFrame after innerHTML is nowhere near long enough to
  // wait that out. Measuring early bakes the wrong geometry into every
  // item's cached centre below, permanently: a generated SVG pack (sized
  // synchronously) ends up fine, but a real logo's curve and scroll
  // distance stay wrong for the rest of the page's life. img.decode()
  // is the same wait document.fonts.ready does for web fonts elsewhere
  // in this codebase, just for images.
  const images = $$('img', track);
  const decodeAll = images.length
    ? Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : null)))
    : Promise.resolve();
  // Race a hard ceiling against it: a real logo `brand-mark.js` did not
  // mark eager, or one the browser is simply slow to fetch, must not be
  // able to hang the whole ribbon — better a slightly wrong initial
  // curve/distance than a marquee that never starts.
  const timeout = new Promise((resolve) => setTimeout(resolve, 800));
  const settled = Promise.race([decodeAll, timeout]);

  settled.then(() => requestAnimationFrame(() => {
    const distance = track.scrollWidth / 2;
    if (!distance) return;

    // Each item's place along the (unanimated) flex row, captured once —
    // combined with the track's live x every frame, that is enough to
    // know where an item currently sits on screen without ever reading
    // layout back off it mid-animation.
    const layout = $$('.marquee__item', track).map((node) => ({
      node,
      centre: node.offsetLeft + node.offsetWidth / 2,
    }));

    /** Bends the ribbon: each item's height and lean follow how far
     *  across the visible band its centre currently falls. */
    const curve = () => {
      const trackX = gsap.getProperty(track, 'x');
      const width = root.clientWidth || 1;

      for (const { node, centre } of layout) {
        // 0 at the left edge of the marquee, 1 at the right; clamped so
        // an item queued off-screen just rests at the baseline instead
        // of arcing below it.
        const t = Math.min(Math.max((centre + trackX) / width, 0), 1);
        const rise = 1 - (2 * t - 1) ** 2; // 0 at each edge, 1 at centre
        const lean = (t - 0.5) * -2; // -1 at the left edge, +1 at the right

        node.style.transform =
          `translateY(${(-ARC_HEIGHT * rise).toFixed(2)}px) rotate(${(lean * ARC_TILT).toFixed(2)}deg)`;
      }
    };

    const tween = gsap.to(track, {
      x: -distance * dirFactor(),
      duration: distance / speed,
      ease: 'none',
      repeat: -1,
      modifiers: {
        x: (value) => `${gsap.utils.wrap(-distance, 0, parseFloat(value))}px`,
      },
      onUpdate: curve,
    });

    curve(); // paint the arc immediately, not just from the first tick

    ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        // Direction follows the scroll; speed eases up slightly while moving.
        tween.timeScale(self.direction * (1 + Math.min(Math.abs(self.getVelocity()) / 3000, 2)));
      },
      onToggle: (self) => (self.isActive ? tween.play() : tween.pause()),
    });
  }));

  return root;
}
