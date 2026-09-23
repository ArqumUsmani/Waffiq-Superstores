/**
 * Pieces shared by the hero variants (HeroScene and Hero):
 * the pointer-tilt rig, the four floating glass cards, and the infinite
 * aisle marquee that closes the section.
 */
import { Link } from 'react-router';
import aislesJson from '../data/aisles.json';
import { gsap } from '../lib/gsap-setup';
import { motion } from '../lib/motion-guard';
import { rafThrottle } from '../lib/dom';
import { pick, t } from '../lib/i18n';
import { branches, categories, totals } from '../lib/data';
import { getCachedReviewSummary } from '../lib/reviews';
import { useRig } from '../hooks/useRig';
import type { Aisle } from '../lib/types';

const emojiFor = new Map((aislesJson as Aisle[]).map((a) => [a.slug, a.emoji]));

/**
 * Tilts the `[data-tilt]` element inside the returned stage toward the
 * pointer. Written to CSS custom properties so the transform stays
 * declarative and the springs never fight a class.
 */
export function useStageTilt<T extends HTMLElement>() {
  return useRig<T>((stage) => {
    if (!motion.hasHover || motion.reduced) return;
    const target = stage.querySelector<HTMLElement>('[data-tilt]');
    if (!target) return;

    const rotX = gsap.quickTo(target, '--tilt-x', { duration: 0.6, ease: 'power3.out' });
    const rotY = gsap.quickTo(target, '--tilt-y', { duration: 0.6, ease: 'power3.out' });
    const shiftX = gsap.quickTo(target, '--tilt-tx', { duration: 0.6, ease: 'power3.out' });
    const shiftY = gsap.quickTo(target, '--tilt-ty', { duration: 0.6, ease: 'power3.out' });

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
}

/**
 * The four floating glass cards. Real numbers where the site has them —
 * the rating only appears once Google has actually returned one, never as
 * an invented figure.
 */
export function HeroCards() {
  const rating = getCachedReviewSummary();
  const hours = branches[0]?.hoursSummary?.split(',').pop()?.trim() ?? '';

  return (
    <div className="hero-grocery__cards">
      <div className="hero-grocery__card">
        <strong>{rating?.rating ? rating.rating.toFixed(1) : '★'}</strong>
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
  );
}

/**
 * Infinite marquee of all ten aisles. Two identical runs, each carrying its
 * own trailing gap, so translating the track by exactly half its width
 * loops without a seam. The second run is hidden from assistive tech.
 */
export function AisleMarquee() {
  return (
    <div className="aisle-marquee" role="region" aria-label={t('marquee.label')}>
      <div className="aisle-marquee__track">
        {[0, 1].map((run) => (
          <div className="aisle-marquee__run" key={run} aria-hidden={run === 1 || undefined}>
            {categories.map((cat) => (
              <Link
                className="aisle-marquee__item"
                key={cat.slug}
                to={`/aisle/${cat.slug}`}
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
  );
}
