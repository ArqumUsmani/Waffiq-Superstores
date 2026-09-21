/**
 * Hero storefront — the real shopfront render, floating in its own glow
 * beneath the wordmark scene, tilting gently toward the pointer.
 *
 * The four cards around it report real numbers only: product count and
 * branch hours come straight from the catalogue and branch data, and the
 * rating card never shows a figure Google has not actually returned (see
 * getCachedReviewSummary in reviews.js) — it upgrades in place the moment
 * the reviews section resolves, via a `wafiq:reviews` event, rather than
 * running its own fetch.
 */
import { $, el, rafThrottle } from '../lib/dom.js';
import { gsap } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { t } from '../lib/i18n.js';
import { totals, branches } from '../lib/data.js';
import { getCachedReviewSummary, FALLBACK_MAPS_URL } from './reviews.js';

function statCard(value, label) {
  return el('div', { class: 'hero-storefront__card' }, el('strong', {}, value), el('span', {}, label));
}

function ratingCard() {
  const cached = getCachedReviewSummary();
  const value = el('strong', {}, cached ? cached.rating.toFixed(1) : '★');
  const label = el('span', {}, cached ? `${cached.count} ${t('heroStorefront.reviewsSuffix')}` : t('heroStorefront.reviewsFallback'));
  const card = el(
    'a',
    { class: 'hero-storefront__card', href: cached?.url ?? FALLBACK_MAPS_URL, target: '_blank', rel: 'noopener noreferrer' },
    value,
    label,
  );

  const onSummary = (event) => {
    const { rating, count, url } = event.detail;
    value.textContent = rating.toFixed(1);
    label.textContent = `${count} ${t('heroStorefront.reviewsSuffix')}`;
    card.href = url;
  };
  document.addEventListener('wafiq:reviews', onSummary);

  return { card, cleanup: () => document.removeEventListener('wafiq:reviews', onSummary) };
}

export function initHeroStorefront(root) {
  if (!root) return () => {};

  const stage = $('[data-hero-storefront-stage]', root);
  const cardsHost = $('[data-hero-storefront-cards]', root);
  const branch = branches[0];

  const { card: rating, cleanup: cleanupRating } = ratingCard();

  cardsHost?.replaceChildren(
    rating,
    statCard(String(totals.products), t('stats.products')),
    statCard(branch?.hoursSummary?.split(',').pop()?.trim() ?? '', t('heroStorefront.hoursLabel')),
    statCard(branch?.city ?? '', t('heroStorefront.locationLabel')),
  );

  let stopTilt = () => {};
  if (stage && motion.hasHover && !motion.reduced) {
    const rotX = gsap.quickTo(stage, '--tilt-x', { duration: 0.5, ease: 'power3.out' });
    const rotY = gsap.quickTo(stage, '--tilt-y', { duration: 0.5, ease: 'power3.out' });
    const shiftX = gsap.quickTo(stage, '--tilt-tx', { duration: 0.5, ease: 'power3.out' });

    const onMove = rafThrottle((event) => {
      const rect = stage.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      rotX(ny * -6);
      rotY(nx * 8);
      shiftX(nx * 14);
    });
    const onLeave = () => {
      rotX(0);
      rotY(0);
      shiftX(0);
    };

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    stopTilt = () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }

  return () => {
    cleanupRating();
    stopTilt();
  };
}
