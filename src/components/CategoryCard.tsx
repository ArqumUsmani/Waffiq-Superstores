/**
 * Category tile: pastel ground, 3D icon, name, shelf and product counts.
 *
 * Hover tilts the card on a perspective stage with the icon lifted on its
 * own Z layer and a rim-light that tracks the pointer, then springs back.
 * Touch and reduced-motion get the same card, just flat.
 *
 * The click never navigates directly — it hands the icon's artwork to the
 * launch transition, which flies it to the centre and floods the screen
 * before committing the route.
 */
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { CategoryIcon, type CategoryIconHandle } from './CategoryIcon';
import { useLaunch } from './LaunchProvider';
import { countInCategory } from '../lib/data';
import { motion } from '../lib/motion-guard';
import { rafThrottle } from '../lib/dom';
import { pick, t } from '../lib/i18n';
import type { Category } from '../lib/types';

const MAX_TILT = 9;
const TOUCH_LIFT_HOLD_MS = 350;

interface Props {
  category: Category;
  index?: number;
  iconSize?: number;
}

export function CategoryCard({ category, index = 0, iconSize = 132 }: Props) {
  const navigate = useNavigate();
  const { launchTo } = useLaunch();

  const cardRef = useRef<HTMLAnchorElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<CategoryIconHandle>(null);
  const lastPointerType = useRef<string>('mouse');

  const name = pick(category as unknown as Record<string, unknown>, 'en');
  const count = countInCategory(category.slug);
  const href = `/aisle/${category.slug}`;

  const move = useRef(
    rafThrottle((event: React.PointerEvent<HTMLAnchorElement>) => {
      const card = cardRef.current;
      const glow = glowRef.current;
      if (!card || !glow) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      card.style.setProperty('--tilt-x', `${(0.5 - py) * MAX_TILT * 2}deg`);
      card.style.setProperty('--tilt-y', `${(px - 0.5) * MAX_TILT * 2}deg`);
      glow.style.setProperty('--glow-x', `${px * 100}%`);
      glow.style.setProperty('--glow-y', `${py * 100}%`);
    }),
  ).current;

  const reset = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.classList.remove('is-tilting');
  };

  const tiltable = motion.hasHover && !motion.reduced;

  const activate = () => {
    const art = iconRef.current?.artEl();
    if (!art) {
      navigate(href);
      return;
    }
    launchTo({ slug: category.slug, sourceEl: art, pastel: category.pastel });
  };

  return (
    <a
      className="category-card"
      href={href}
      ref={cardRef}
      data-cat={category.slug}
      data-reveal=""
      data-reveal-index={index}
      aria-label={`${name} — ${t('categories.explore')}`}
      style={{ '--pastel': category.pastel, '--accent': category.accent } as React.CSSProperties}
      onPointerDown={(event) => {
        lastPointerType.current = event.pointerType;
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return;
        if (tiltable) cardRef.current?.classList.add('is-tilting');
        iconRef.current?.pop();
      }}
      onPointerMove={(event) => {
        if (!tiltable || event.pointerType !== 'mouse') return;
        move(event);
      }}
      onPointerLeave={reset}
      onFocus={() => iconRef.current?.pop()}
      onBlur={reset}
      onClick={(event) => {
        event.preventDefault();
        // Touch has no hover: a tap lifts, holds briefly so the lift is
        // actually seen, then flows straight into the fly-out — one tap.
        if (lastPointerType.current === 'touch' && !motion.reduced) {
          iconRef.current?.pop();
          window.setTimeout(activate, TOUCH_LIFT_HOLD_MS);
          return;
        }
        activate();
      }}
    >
      <span className="category-card__mask" aria-hidden="true">
        <span className="category-card__glow" aria-hidden="true" ref={glowRef} />
      </span>

      <div className="category-card__stage">
        <CategoryIcon category={category} size={iconSize} ref={iconRef} />
      </div>

      <div className="category-card__body">
        <h3 className="category-card__name">{name}</h3>
        <p className="category-card__meta">
          <span>
            {category.subcategories.length} {t('aisle.shelves')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {count} {t('aisle.products')}
          </span>
        </p>
      </div>

      <span className="icon-btn category-card__go" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </a>
  );
}
