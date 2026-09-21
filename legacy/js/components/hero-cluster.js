/**
 * Hero: the floating pantry.
 *
 * Giant lime "WAFIQ" display type with grocery objects orbiting it —
 * several passing in front of the letterforms, so the type reads as a
 * physical thing in the scene rather than a background layer.
 *
 * The objects are currently the generated category icons. Each one is a
 * single <span data-piece> whose contents get replaced by a cutout WebP
 * the moment real artwork lands in src/assets/cutouts (see
 * docs/asset-prompts.md) — the motion rig does not change.
 */
import { $, $$, el, splitChars, rafThrottle, uniquifySvgIds } from '../lib/dom.js';
import { gsap, ScrollTrigger } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { attachMagnet } from './cursor.js';

const POSTERS = import.meta.glob('../../assets/categories/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const RENDERS = import.meta.glob('../../assets/categories/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

const CUTOUTS = import.meta.glob('../../assets/cutouts/*.{webp,png}', {
  query: '?url',
  import: 'default',
  eager: true,
});

/**
 * Where each object sits, how big it is, and how far from the camera.
 * `front: true` puts the object in front of the display type.
 * `depth` drives the pointer parallax — 1 is far, 4 is close.
 */
const PIECES = [
  { slug: 'tea-coffee-breakfast', x: 8, y: 24, size: 132, depth: 3, front: false, spin: -8, small: true },
  { slug: 'milk-beverages', x: 20, y: 66, size: 158, depth: 4, front: true, spin: 6 },
  { slug: 'snacks-confectionery', x: 34, y: 14, size: 104, depth: 2, front: false, spin: 10, small: true },
  { slug: 'cooking-baking', x: 47, y: 72, size: 150, depth: 4, front: true, spin: -5 },
  { slug: 'condiments-canned', x: 62, y: 18, size: 116, depth: 2, front: false, spin: 7, small: true },
  { slug: 'personal-care', x: 76, y: 64, size: 142, depth: 3, front: true, spin: -9 },
  { slug: 'cleaning-fresheners', x: 89, y: 30, size: 122, depth: 2, front: false, spin: 5 },
  { slug: 'baby-hygiene', x: 5, y: 78, size: 96, depth: 1, front: false, spin: -6 },
  { slug: 'home-kitchen', x: 94, y: 76, size: 100, depth: 1, front: false, spin: 8 },
];

/** The lime swoosh from the logo, redrawn as a single strokeable path. */
const SWOOSH =
  'M4 62 C 4 26, 40 10, 66 30 C 88 47, 104 58, 128 44 C 150 31, 158 14, 156 4';

function piece(spec, index) {
  const image =
    CUTOUTS[`../../assets/cutouts/${spec.slug}.webp`] ??
    CUTOUTS[`../../assets/cutouts/${spec.slug}.png`] ??
    RENDERS[`../../assets/categories/${spec.slug}.png`];
  const art = image
    ? `<img src="${image}" alt="" width="${spec.size}" height="${spec.size}" decoding="async">`
    : uniquifySvgIds(POSTERS[`../../assets/categories/${spec.slug}.svg`] ?? '');

  // Outer node owns placement and pointer parallax (CSS custom properties);
  // the inner node is GSAP's to animate, so the two never fight over
  // the same transform.
  return el(
    'span',
    {
      class: `hero-piece hero-piece--${spec.front ? 'front' : 'back'}`,
      'aria-hidden': 'true',
      dataset: {
        piece: spec.slug,
        depth: String(spec.depth),
        index: String(index),
        ...(spec.small ? { small: '' } : {}),
      },
      style: {
        '--x': `${spec.x}%`,
        '--y': `${spec.y}%`,
        '--size': `${spec.size}px`,
        '--spin': `${spec.spin}deg`,
      },
    },
    el('span', { class: 'hero-piece__art', dataset: { pieceArt: '' }, html: art }),
  );
}

/**
 * A small chip that drifts toward the pointer anywhere over the hero,
 * and settles back to rest the moment the pointer leaves — the
 * "floating badge" effect. Desktop pointers only; it never mounts under
 * reduced motion, and it only ever moves in response to the pointer, so
 * there is nothing running while the hand is still.
 */
function floatBadge(root, badge) {
  if (!badge || !motion.hasHover) return () => {};

  const x = gsap.quickTo(badge, 'x', { duration: 0.7, ease: 'power3.out' });
  const y = gsap.quickTo(badge, 'y', { duration: 0.7, ease: 'power3.out' });

  const onMove = rafThrottle((event) => {
    const rect = root.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    x(nx * 34);
    y(ny * 20);
  });
  const onLeave = () => {
    x(0);
    y(0);
  };

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  return () => {
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
  };
}

export function initHero(root = $('[data-hero]')) {
  if (!root) return () => {};

  const stage = $('[data-hero-stage]', root);
  const display = $('[data-hero-display]', root);
  const swooshHost = $('[data-hero-swoosh]', root);
  const connector = $('[data-hero-connector]', root);
  const card = $('[data-hero-card]', root);
  const cta = $('[data-hero-cta]', root);
  const badge = $('[data-hero-badge]', root);

  // Re-entrant: a language switch rebuilds the hero, so clear any layers
  // from a previous mount before adding new ones.
  for (const old of stage.querySelectorAll('.hero-layer')) old.remove();

  // Objects: behind the type first, then in front of it.
  const back = el('div', { class: 'hero-layer hero-layer--back', 'aria-hidden': 'true' });
  const front = el('div', { class: 'hero-layer hero-layer--front', 'aria-hidden': 'true' });

  PIECES.forEach((spec, i) => (spec.front ? front : back).append(piece(spec, i)));
  stage.prepend(back);
  stage.append(front);

  if (swooshHost) {
    swooshHost.innerHTML = `
      <svg viewBox="0 0 160 66" fill="none" aria-hidden="true">
        <path d="${SWOOSH}" stroke="currentColor" stroke-width="13"
              stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
      </svg>`;
  }

  if (cta) attachMagnet(cta);

  const chars = display ? splitChars(display) : [];
  const pieces = $$('[data-piece]', stage);
  const arts = $$('[data-piece-art]', stage);

  if (motion.reduced) {
    gsap.set([chars, arts, card, connector].flat().filter(Boolean), { opacity: 1, clearProps: 'all' });
    root.classList.add('is-ready');
    return () => {};
  }

  const context = gsap.context(() => {
    /* ---- entry ---- */
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

    intro
      .fromTo(
        '[data-hero-swoosh] path',
        { strokeDasharray: 1, strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' },
      )
      .from(chars, { yPercent: 118, opacity: 0, duration: 0.9, stagger: 0.045 }, '-=0.65')
      .from(
        arts,
        {
          y: 70,
          scale: 0.72,
          opacity: 0,
          rotate: (i) => (i % 2 ? 14 : -14),
          duration: 1,
          ease: 'back.out(1.5)',
          stagger: { each: 0.07, from: 'center' },
        },
        '-=0.55',
      )
      .from('[data-hero-line]', { y: 24, opacity: 0, duration: 0.7, stagger: 0.08 }, '-=0.7')
      .fromTo(
        '[data-hero-connector] path',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' },
        '-=0.5',
      )
      .from(card, { x: 26, opacity: 0, duration: 0.7 }, '-=0.75')
      .add(() => root.classList.add('is-ready'));

    // `badge` is optional — markup without [data-hero-badge] skips this
    // entirely rather than handing GSAP an empty target (which warns,
    // it turns out, same as a genuinely missing one). Absolute position
    // 0: the badge drops in alongside the swoosh regardless of where
    // this call is added, so it cannot disturb any '-=' offset above.
    if (badge) intro.from(badge, { y: -16, opacity: 0, duration: 0.6 }, 0);

    /* ---- scroll parallax: the scene settles as the page moves on ----
       No idle loop: after the entry the objects hold still and only
       respond to the pointer and to scrolling. ---- */
    gsap.to(arts, {
      yPercent: (i) => -14 - Number(arts[i].parentElement.dataset.depth) * 7,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });

    gsap.to(display, {
      yPercent: 18,
      opacity: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
  }, root);

  /* ---- pointer parallax ---- */
  let stopPointer = () => {};
  if (motion.hasHover) {
    const setters = pieces.map((node) => ({
      node,
      depth: Number(node.dataset.depth),
      x: gsap.quickTo(node, '--px', { duration: 0.9, ease: 'power2.out' }),
      y: gsap.quickTo(node, '--py', { duration: 0.9, ease: 'power2.out' }),
    }));

    const onMove = rafThrottle((event) => {
      const rect = root.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;

      for (const { depth, x, y } of setters) {
        x(nx * depth * 13);
        y(ny * depth * 9);
      }
    });

    root.addEventListener('pointermove', onMove);
    stopPointer = () => root.removeEventListener('pointermove', onMove);
  }

  const stopBadge = floatBadge(root, badge);

  return () => {
    stopPointer();
    stopBadge();
    context.revert();
    ScrollTrigger.refresh();
  };
}
