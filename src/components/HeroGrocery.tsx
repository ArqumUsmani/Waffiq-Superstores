/**
 * Hero — grocery bag variation.
 *
 * A deep-green immersive section with a rounded bottom that melts into the
 * bright body. The centrepiece is a kraft paper sack built entirely from
 * CSS and SVG — folded cuff, crease lines, a rope handle, side shading from
 * inset shadows, a contact shadow and a printed front label — with fresh
 * produce spilling out of the top on staggered bob delays.
 *
 * The whole bag tilts toward the pointer. That rig is the only JavaScript
 * here; everything else is CSS keyframes, so reduced motion is handled by
 * the global killswitch.
 *
 * `HeroStorefront` is the interchangeable alternate — swap the import in
 * Home.tsx to use the photographic storefront instead.
 */
import { Link } from 'react-router';
import type { CSSProperties } from 'react';
import monogram from '../assets/logo/monogram.svg?raw';
import aislesJson from '../data/aisles.json';
import { BackgroundLayers } from './Background';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { rafThrottle } from '../lib/dom';
import { pick, t } from '../lib/i18n';
import { branches, categories, totals } from '../lib/data';
import { getCachedReviewSummary } from '../lib/reviews';
import { useRig } from '../hooks/useRig';
import { useMagnet } from '../hooks/useMagnet';
import type { Aisle } from '../lib/types';

const AISLES = aislesJson as Aisle[];
const emojiFor = new Map(AISLES.map((a) => [a.slug, a.emoji]));

/** Produce spilling out of the bag's mouth. */
const SPILL = [
  { emoji: '🥬', x: '20%', y: '8%', size: '2.9rem', dur: '4.2s', delay: '0s' },
  { emoji: '🥕', x: '33%', y: '30%', size: '2.3rem', dur: '3.6s', delay: '-0.7s' },
  { emoji: '🍅', x: '46%', y: '48%', size: '2.1rem', dur: '4.6s', delay: '-1.4s' },
  { emoji: '🍞', x: '58%', y: '28%', size: '2.7rem', dur: '3.9s', delay: '-2.1s' },
  { emoji: '🥦', x: '70%', y: '6%', size: '2.8rem', dur: '4.4s', delay: '-0.4s' },
  { emoji: '🍇', x: '80%', y: '34%', size: '2.2rem', dur: '4.1s', delay: '-2.8s' },
  { emoji: '🌶️', x: '12%', y: '38%', size: '1.9rem', dur: '3.7s', delay: '-1.8s' },
  { emoji: '🥛', x: '88%', y: '10%', size: '2.4rem', dur: '4.8s', delay: '-3.2s' },
];

export function HeroGrocery() {
  const ctaRef = useMagnet<HTMLAnchorElement>();
  const branch = branches[0];
  const rating = getCachedReviewSummary();

  /* Mouse-parallax tilt on the bag. Written to CSS custom properties so the
     transform stays declarative and the springs never fight a class. */
  const stageRef = useRig<HTMLDivElement>((stage) => {
    if (!motion.hasHover || motion.reduced) return;
    const bag = stage.querySelector<HTMLElement>('[data-bag]');
    if (!bag) return;

    const rotX = gsap.quickTo(bag, '--tilt-x', { duration: 0.6, ease: 'power3.out' });
    const rotY = gsap.quickTo(bag, '--tilt-y', { duration: 0.6, ease: 'power3.out' });
    const shiftX = gsap.quickTo(bag, '--tilt-tx', { duration: 0.6, ease: 'power3.out' });
    const shiftY = gsap.quickTo(bag, '--tilt-ty', { duration: 0.6, ease: 'power3.out' });

    const onMove = rafThrottle((event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      rotX(ny * -10);
      rotY(nx * 14);
      shiftX(nx * 22);
      shiftY(ny * 12);
    });
    const onLeave = () => {
      rotX(0);
      rotY(0);
      shiftX(0);
      shiftY(0);
    };

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  });

  const hours = branch?.hoursSummary?.split(',').pop()?.trim() ?? '';

  return (
    <section className="hero-grocery" id="home" aria-labelledby="hero-title">
      <div className="hero-grocery__bg" aria-hidden="true">
        <BackgroundLayers />
      </div>

      <div className="shell hero-grocery__inner">
        <p className="hero-grocery__badge">
          <span className="hero-grocery__dot" aria-hidden="true" />
          {t('heroBag.badge')}
        </p>

        <h1 className="hero-grocery__title" id="hero-title">
          {t('heroBag.titleLead')}{' '}
          <span className="hero-grocery__accent">
            {t('heroBag.titleAccent')}
            <svg
              className="hero-grocery__underline"
              viewBox="0 0 300 18"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <path
                d="M4 12.5C52 5.5 108 3.5 160 6.5C212 9.5 260 13 296 8"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={1}
              />
            </svg>
          </span>
        </h1>

        <p className="hero-grocery__sub">{t('heroBag.sub')}</p>

        <div className="hero-grocery__actions">
          <Link className="btn btn--light" to="/aisle/fruits-vegetables" ref={ctaRef}>
            <span>{t('heroBag.ctaPrimary')}</span>
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
            <span>{t('heroBag.ctaSecondary')}</span>
          </a>
        </div>

        {/* ---- stage ---- */}
        <div className="hero-grocery__stage" ref={stageRef}>
          <p className="hero-grocery__ghost" aria-hidden="true">
            FRESH
          </p>
          <span className="hero-grocery__glow" aria-hidden="true" />

          <div className="hero-grocery__bag" data-bag aria-hidden="true">
            {/* Rope handle — a single arc, drawn above the cuff. */}
            <svg className="bag__handle" viewBox="0 0 120 60" fill="none" aria-hidden="true">
              <path
                d="M8 58C8 24 30 6 60 6C90 6 112 24 112 58"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
              />
            </svg>

            <div className="bag__body">
              <span className="bag__cuff" />
              <span className="bag__creases" />
              <div className="bag__label">
                <span dangerouslySetInnerHTML={{ __html: monogram }} />
                <span className="bag__label-name">WAFIQ</span>
                <span className="bag__label-sub">Fresh Groceries · Daily</span>
              </div>
            </div>

            <span className="bag__shadow" />
          </div>

          <div className="bag__spill" aria-hidden="true">
            {SPILL.map((item) => (
              <span
                key={item.emoji}
                className="bag__item"
                style={
                  {
                    '--x': item.x,
                    '--y': item.y,
                    '--size': item.size,
                    '--dur': item.dur,
                    '--delay': item.delay,
                  } as CSSProperties
                }
              >
                {item.emoji}
              </span>
            ))}
          </div>

          {/* Four floating glass cards. Real numbers where the site has
              them — the rating only appears once Google has actually
              returned one, never as an invented figure. */}
          <div className="hero-grocery__cards">
            <div className="hero-grocery__card">
              <strong>{rating ? rating.rating?.toFixed(1) : '★'}</strong>
              <span>
                {rating ? `${rating.count} ${t('heroBag.cardReviews')}` : t('heroBag.cardRated')}
              </span>
            </div>
            <div className="hero-grocery__card">
              <strong>{totals.products}</strong>
              <span>{t('stats.products')}</span>
            </div>
            <div className="hero-grocery__card">
              <strong>{hours}</strong>
              <span>{t('heroStorefront.hoursLabel')}</span>
            </div>
            <div className="hero-grocery__card">
              <strong>{t('heroBag.cardFresh')}</strong>
              <span>{t('heroBag.cardFreshSub')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- infinite aisle marquee ---- */}
      <div className="aisle-marquee" aria-label={t('marquee.label')}>
        <div className="aisle-marquee__track">
          {[0, 1].map((run) => (
            <div key={run} className="aisle-marquee__track" style={{ animation: 'none', gap: '2.5rem' }}>
              {categories.map((cat) => (
                <Link
                  className="aisle-marquee__item"
                  key={`${run}-${cat.slug}`}
                  to={`/aisle/${cat.slug}`}
                  aria-hidden={run === 1}
                  tabIndex={run === 1 ? -1 : undefined}
                >
                  <em aria-hidden="true">{emojiFor.get(cat.slug) ?? '🛒'}</em>
                  {pick(cat as unknown as Record<string, unknown>, 'en')}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
