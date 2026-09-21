/**
 * Hero: the floating pantry.
 *
 * Giant lime "WAFIQ" display type with grocery objects orbiting it —
 * several passing in front of the letterforms, so the type reads as a
 * physical thing in the scene rather than a background layer.
 *
 * React renders the markup; the rig owns every tween. The <h1> is
 * deliberately uncontrolled: splitChars() shreds its text into per-character
 * spans, so React must never re-render its children. A language change
 * remounts the whole hero via `key` instead.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { gsap, ScrollTrigger } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { splitChars, rafThrottle, uniquifySvgIds } from '../lib/dom';
import { t } from '../lib/i18n';
import { categoryPoster, categoryRender, cutout } from '../assets/registry';
import { useRig } from '../hooks/useRig';
import { useMagnet } from '../hooks/useMagnet';

interface Piece {
  slug: string;
  x: number;
  y: number;
  size: number;
  /** 1 is far, 4 is close — drives the pointer parallax. */
  depth: number;
  front: boolean;
  spin: number;
  small?: boolean;
}

/** Where each object sits, how big it is, and how far from the camera. */
const PIECES: Piece[] = [
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
const SWOOSH = 'M4 62 C 4 26, 40 10, 66 30 C 88 47, 104 58, 128 44 C 150 31, 158 14, 156 4';

/**
 * The art span itself carries the SVG, never a wrapper around it —
 * `.hero-piece > .hero-piece__art > *` sizes the *direct* child, so an
 * extra element in between collapses the artwork to zero width.
 */
function PieceArt({ spec }: { spec: Piece }) {
  const image = cutout(spec.slug) ?? categoryRender(spec.slug);
  const poster = image ? undefined : categoryPoster(spec.slug);

  // Memoised per instance: re-running uniquifySvgIds would mint fresh ids on
  // every render. Keyed per instance rather than per slug, so two copies of
  // the same poster still get different gradient ids.
  const markup = useMemo(() => (poster ? uniquifySvgIds(poster) : null), [poster]);

  return (
    <span
      className="hero-piece__art"
      data-piece-art=""
      {...(markup ? { dangerouslySetInnerHTML: { __html: markup } } : {})}
    >
      {image ? (
        <img src={image} alt="" width={spec.size} height={spec.size} decoding="async" />
      ) : null}
    </span>
  );
}

export function HeroCluster() {
  const ctaRef = useMagnet<HTMLAnchorElement>();

  const rootRef = useRig<HTMLElement>((root) => {
    const stage = root.querySelector<HTMLElement>('[data-hero-stage]');
    const display = root.querySelector<HTMLElement>('[data-hero-display]');
    const connector = root.querySelector<HTMLElement>('[data-hero-connector]');
    const card = root.querySelector<HTMLElement>('[data-hero-card]');
    if (!stage || !display) return;

    const chars = splitChars(display);
    const pieces = [...stage.querySelectorAll<HTMLElement>('[data-piece]')];
    const arts = [...stage.querySelectorAll<HTMLElement>('[data-piece-art]')];

    if (motion.reduced) {
      gsap.set([chars, arts, card, connector].flat().filter(Boolean) as HTMLElement[], {
        opacity: 1,
        clearProps: 'all',
      });
      root.classList.add('is-ready');
      return;
    }

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
          rotate: (i: number) => (i % 2 ? 14 : -14),
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

    /* ---- scroll parallax: the scene settles as the page moves on ----
       No idle loop: after the entry the objects hold still and only
       respond to the pointer and to scrolling. ---- */
    gsap.to(arts, {
      yPercent: (i: number) => -14 - Number(arts[i]!.parentElement!.dataset.depth) * 7,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });

    gsap.to(display, {
      yPercent: 18,
      opacity: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });

    /* ---- pointer parallax ---- */
    if (!motion.hasHover) return;

    const setters = pieces.map((node) => ({
      depth: Number(node.dataset.depth),
      x: gsap.quickTo(node, '--px', { duration: 0.9, ease: 'power2.out' }),
      y: gsap.quickTo(node, '--py', { duration: 0.9, ease: 'power2.out' }),
    }));

    const onMove = rafThrottle((event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      for (const { depth, x, y } of setters) {
        x(nx * depth * 13);
        y(ny * depth * 9);
      }
    });

    root.addEventListener('pointermove', onMove);
    return () => {
      root.removeEventListener('pointermove', onMove);
      ScrollTrigger.refresh();
    };
  });

  const back = PIECES.filter((p) => !p.front);
  const front = PIECES.filter((p) => p.front);

  const layer = (specs: Piece[], name: 'back' | 'front') => (
    <div className={`hero-layer hero-layer--${name}`} aria-hidden="true">
      {specs.map((spec) => (
        <span
          key={spec.slug}
          className={`hero-piece hero-piece--${spec.front ? 'front' : 'back'}`}
          aria-hidden="true"
          data-piece={spec.slug}
          data-depth={spec.depth}
          {...(spec.small ? { 'data-small': '' } : {})}
          style={
            {
              '--x': `${spec.x}%`,
              '--y': `${spec.y}%`,
              '--size': `${spec.size}px`,
              '--spin': `${spec.spin}deg`,
            } as React.CSSProperties
          }
        >
          <PieceArt spec={spec} />
        </span>
      ))}
    </div>
  );

  return (
    <section
      className="hero grain"
      id="home"
      ref={rootRef}
      aria-labelledby="hero-title"
    >
      <div className="shell">
        <p className="hero__badge">{t('hero.badge')}</p>

        <div className="hero__stage" data-hero-stage>
          {layer(back, 'back')}
          <span className="hero__swoosh" data-hero-swoosh aria-hidden="true">
            <svg viewBox="0 0 160 66" fill="none" aria-hidden="true">
              <path
                d={SWOOSH}
                stroke="currentColor"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
              />
            </svg>
          </span>
          <h1 className="hero__display" id="hero-title" data-hero-display>
            {t('hero.display')}
          </h1>
          {layer(front, 'front')}
        </div>

        <div className="hero__lower">
          <div>
            <p className="hero__sub" data-hero-line>
              {t('hero.sub')}
            </p>

            <div className="hero__actions" data-hero-line>
              <Link className="btn btn--light" to="/aisle/fruits-vegetables" ref={ctaRef}>
                <span>{t('hero.ctaPrimary')}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <a
                className="btn btn--ghost"
                href="#branches"
                style={{ color: '#fff', borderColor: 'rgb(255 255 255 / 0.3)' }}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById('branches')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span>{t('hero.ctaSecondary')}</span>
              </a>
            </div>

            <p className="hero__scroll">{t('hero.scroll')}</p>
          </div>

          <div className="hero__aside">
            <svg
              className="hero__connector"
              data-hero-connector
              viewBox="0 0 220 120"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 6 C 62 14, 100 46, 86 72 C 77 90, 46 88, 53 67 C 60 46, 100 52, 132 68 C 170 86, 198 98, 218 104"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="0.014 0.02"
                pathLength={1}
              />
            </svg>

            <div className="hero__card" data-hero-card>
              <strong>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{t('hero.cardTitle')}</span>
              </strong>
              <a
                href="#branches"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById('branches')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {t('hero.cardLink')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
