/**
 * Category tile: pastel ground, 3D icon, name, shelf and product counts.
 *
 * Hover tilts the card on a perspective stage with the icon lifted on its
 * own Z layer and a rim-light that tracks the pointer, then springs back.
 * Touch and reduced-motion get the same card, just flat.
 *
 * Every icon with an activate() — an interactive scene or a plain static
 * render alike, both from category-icon.js — gets the fly-out-and-grow
 * click transition instead of a bare navigation. A scene additionally
 * gets enter()/leave() on hover and focus in place of the plain pop();
 * a render has neither, so attachLaunch() below just skips that part
 * and attachTilt()'s own pop() keeps running as it always did.
 */
import { el, escapeHtml, rafThrottle } from '../lib/dom.js';
import { countInCategory } from '../lib/data.js';
import { createCategoryIcon } from './category-icon.js';
import { motion } from '../lib/motion-guard.js';
import { t, pick } from '../lib/i18n.js';

const MAX_TILT = 9;
const TOUCH_LIFT_HOLD_MS = 350;

/** Adds a `<link rel="prefetch">` for `href` at most once per page. */
function prefetch(href) {
  if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
  document.head.append(el('link', { rel: 'prefetch', href }));
}

export function categoryCard(category, { iconSize = 132, index = 0 } = {}) {
  const count = countInCategory(category.slug);
  const name = pick(category, 'en');
  const href = `/category.html?cat=${encodeURIComponent(category.slug)}`;

  const card = el('a', {
    class: 'category-card',
    href,
    style: { '--pastel': category.pastel, '--accent': category.accent },
    dataset: { cat: category.slug, reveal: '', revealIndex: String(index) },
  });

  const stage = el('div', { class: 'category-card__stage' });
  const icon = createCategoryIcon({ slug: category.slug, size: iconSize });
  stage.append(icon.el);

  const body = el('div', { class: 'category-card__body' });
  body.innerHTML = `
    <h3 class="category-card__name">${escapeHtml(name)}</h3>
    <p class="category-card__meta">
      <span>${category.subcategories.length} ${escapeHtml(t('aisle.shelves'))}</span>
      <span aria-hidden="true">·</span>
      <span>${count} ${escapeHtml(t('aisle.products'))}</span>
    </p>
  `;

  const cta = el('span', {
    class: 'icon-btn category-card__go',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  });

  const glow = el('span', { class: 'category-card__glow', 'aria-hidden': 'true' });
  const mask = el('span', { class: 'category-card__mask', 'aria-hidden': 'true' }, glow);

  card.append(mask, stage, body, cta);
  card.setAttribute('aria-label', `${name} — ${t('categories.explore')}`);

  if (motion.hasHover && !motion.reduced) attachTilt(card, glow, icon);
  if (icon.activate) attachLaunch(card, icon, href);

  return { el: card, icon };
}

function attachTilt(card, glow, icon) {
  const move = rafThrottle((event) => {
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    card.style.setProperty('--tilt-x', `${(0.5 - py) * MAX_TILT * 2}deg`);
    card.style.setProperty('--tilt-y', `${(px - 0.5) * MAX_TILT * 2}deg`);
    glow.style.setProperty('--glow-x', `${px * 100}%`);
    glow.style.setProperty('--glow-y', `${py * 100}%`);
  });

  const reset = () => {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.classList.remove('is-tilting');
  };

  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    card.classList.add('is-tilting');
    // A scene's own pointerenter listener (attachScene, below) drives its
    // enter()/leave() — this one only owns the tilt, and still calls the
    // plain pop() for a non-scene icon.
    if (!icon.enter) icon.pop();
  });
  card.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    move(event);
  });
  card.addEventListener('pointerleave', reset);
  card.addEventListener('blur', reset);
  card.addEventListener('focus', () => {
    if (!icon.enter) icon.pop();
  });
}

/**
 * Routes a card's click through the icon's activate() — the fly-out-
 * and-grow transition — instead of a plain link navigation. If the icon
 * also has enter()/leave() (an interactive scene, not a plain render),
 * hover and focus drive those too, in place of attachTilt()'s pop().
 * `icon.enter?.()` is the entire distinction: everything else here runs
 * the same for a scene or a static render.
 */
function attachLaunch(card, icon, href) {
  let lastPointerType = 'mouse';

  card.addEventListener('pointerdown', (event) => {
    lastPointerType = event.pointerType;
  });

  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    prefetch(href);
    icon.enter?.();
  });
  card.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    icon.leave?.();
  });

  // Keyboard focus lifts silently — no sound on every tab stop — and
  // Enter/Space run the same activate() sequence as a click (the browser
  // fires a click for both on an <a>, so no separate keydown handler).
  card.addEventListener('focus', () => {
    prefetch(href);
    icon.enter?.({ silent: true });
  });
  card.addEventListener('blur', () => icon.leave?.({ silent: true }));

  card.addEventListener('click', (event) => {
    event.preventDefault();

    // Touch has no hover: a tap lifts (a real gesture, so the pickup
    // sound plays), holds briefly so the lift is actually seen, then
    // flows straight into the fly-out — one tap, not a tap-then-tap. A
    // render has nothing to lift, so it skips straight to activate().
    if (lastPointerType === 'touch' && !motion.reduced && icon.enter) {
      icon.enter();
      window.setTimeout(() => icon.activate(href), TOUCH_LIFT_HOLD_MS);
      return;
    }

    icon.activate(href);
  });
}

/** The full category grid used on categories.html. */
export function categoryGrid(categories) {
  const grid = el('div', { class: 'category-grid' });
  const icons = [];
  categories.forEach((category, index) => {
    const card = categoryCard(category, { index });
    icons.push(card.icon);
    grid.append(card.el);
  });
  return { el: grid, icons };
}
