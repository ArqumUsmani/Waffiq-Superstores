import { $, el, escapeHtml } from '../lib/dom.js';
import {
  getCategory,
  productsInCategory,
  productsInSubcategory,
  brandsInCategory,
  countInSubcategory,
  refineProducts,
} from '../lib/data.js';
import { productGrid } from '../components/product-card.js';
import { createCategoryIcon } from '../components/category-icon.js';
import { resolveItemArt } from '../components/basket-scene.js';
import { initReveals, initShelfRules } from '../components/reveal.js';
import { gsap } from '../lib/gsap-setup.js';
import { motion } from '../lib/motion-guard.js';
import { t, pick } from '../lib/i18n.js';

const params = () => new URLSearchParams(window.location.search);
const SCENE_HERO_KEY = 'wafiq:scene-hero';

/**
 * The large arrival image shown in place of the interactive scene icon
 * when a basket-scene fly-out chose this page. Deliberately a fresh,
 * self-contained entrance rather than a pixel-continuation of whatever
 * the previous page was doing — a static multi-page site cannot rely on
 * the browser's cross-document View Transition to hand off a JS-rendered
 * element reliably, so this stands on its own instead of depending on it.
 */
function renderSceneHero(stage, category, itemId) {
  stage.classList.add('aisle-head__stage--hero');

  const wash = el('span', { class: 'aisle-head__hero-wash', 'aria-hidden': 'true' });
  const img = el('img', {
    class: 'aisle-head__hero-img',
    src: resolveItemArt(category.slug, itemId),
    alt: '',
    'aria-hidden': 'true',
    decoding: 'async',
  });
  stage.append(wash, img);

  if (motion.reduced) return;

  gsap.fromTo(img, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'power3.out' });
  gsap.fromTo(wash, { opacity: 1 }, { opacity: 0, duration: 0.55, delay: 0.1, ease: 'power2.out' });
}

/**
 * Reads, and immediately clears, the item a basket scene's fly-out chose
 * before navigating here. One-shot by design: a reload or a same-page
 * language refresh should land on the plain interactive scene, not
 * replay an arrival that already happened.
 */
function takeSceneHero() {
  try {
    const id = sessionStorage.getItem(SCENE_HERO_KEY);
    sessionStorage.removeItem(SCENE_HERO_KEY);
    return id;
  } catch {
    return null;
  }
}

export default function categoryPage() {
  const root = $('[data-category-page]');
  if (!root) return null;

  const category = getCategory(params().get('cat') ?? '');

  if (!category) {
    root.innerHTML = `
      <div class="empty-state shell">
        <h1 data-i18n="category.notFound">${escapeHtml(t('category.notFound'))}</h1>
        <p data-i18n="category.notFoundBody">${escapeHtml(t('category.notFoundBody'))}</p>
        <a class="btn btn--solid" href="/categories.html" data-i18n="nav.categories">${escapeHtml(t('nav.categories'))}</a>
      </div>`;
    return null;
  }

  document.title = `${category.en} — Wafiq Superstores`;
  root.style.setProperty('--pastel', category.pastel);
  root.style.setProperty('--accent', category.accent);

  const state = {
    shelf: params().get('shelf') ?? '',
    brand: '',
    sort: 'featured',
  };

  let icon = null;
  // Consumed once: after the first renderHead() (the initial page load),
  // this is null, so a later refresh() from a language switch falls
  // back to the normal interactive icon rather than replaying the arrival.
  let heroId = category.scene ? takeSceneHero() : null;

  const head = $('[data-aisle-head]', root);
  const tabs = $('[data-shelf-tabs]', root);
  const controls = $('[data-controls]', root);
  const results = $('[data-results]', root);
  const summary = $('[data-summary]', root);

  /* ---------------------------------------------------------------- */

  const renderHead = () => {
    icon?.destroy();
    icon = heroId ? null : createCategoryIcon({ slug: category.slug, size: 168 });

    // One wrapper, so the two-column grid gets exactly two children
    // instead of scattering four paragraphs across the cells.
    head.innerHTML = `
      <div class="aisle-head__text">
        <p class="eyebrow" data-i18n="categories.eyebrow">${escapeHtml(t('categories.eyebrow'))}</p>
        <h1 class="aisle-head__title">${escapeHtml(pick(category, 'en'))}</h1>
        <p class="aisle-head__blurb">${escapeHtml(pick(category, 'blurbEn'))}</p>
        <p class="aisle-head__meta">
          <span class="pill pill--quiet">${category.subcategories.length} ${escapeHtml(t('aisle.shelves'))}</span>
          <span class="pill pill--quiet">${productsInCategory(category.slug).length} ${escapeHtml(t('aisle.products'))}</span>
        </p>
      </div>`;

    const stage = el('div', { class: 'aisle-head__stage' });

    if (heroId) {
      renderSceneHero(stage, category, heroId);
      heroId = null; // consumed — a refresh() falls back to the plain icon
    } else {
      stage.append(icon.el);
    }

    head.append(stage);
  };

  const renderTabs = () => {
    const all = productsInCategory(category.slug).length;

    tabs.innerHTML = `
      <button type="button" class="chip${state.shelf ? '' : ' is-active'}" data-shelf="">
        ${escapeHtml(t('category.all'))} <span class="chip__count">${all}</span>
      </button>
      ${category.subcategories
        .map(
          (sub) => `
          <button type="button" class="chip${state.shelf === sub.slug ? ' is-active' : ''}"
                  data-shelf="${escapeHtml(sub.slug)}">
            ${escapeHtml(pick(sub, 'en'))} <span class="chip__count">${countInSubcategory(sub.slug)}</span>
          </button>`,
        )
        .join('')}`;
  };

  const renderControls = () => {
    const brands = brandsInCategory(category.slug);

    controls.innerHTML = `
      <label class="field">
        <span class="field__label">${escapeHtml(t('category.brandLabel'))}</span>
        <select data-brand>
          <option value="">${escapeHtml(t('category.allBrands'))}</option>
          ${brands
            .map(
              (brand) =>
                `<option value="${escapeHtml(brand)}"${state.brand === brand ? ' selected' : ''}>${escapeHtml(brand)}</option>`,
            )
            .join('')}
        </select>
      </label>
      <label class="field">
        <span class="field__label">${escapeHtml(t('category.sortLabel'))}</span>
        <select data-sort>
          <option value="featured">${escapeHtml(t('category.sortDefault'))}</option>
          <option value="az">${escapeHtml(t('category.sortAz'))}</option>
          <option value="za">${escapeHtml(t('category.sortZa'))}</option>
          <option value="brand">${escapeHtml(t('category.sortBrand'))}</option>
        </select>
      </label>
      <button type="button" class="btn btn--ghost btn--sm" data-clear
              ${state.brand || state.sort !== 'featured' ? '' : 'hidden'}>
        ${escapeHtml(t('category.clear'))}
      </button>`;

    const sortSelect = $('[data-sort]', controls);
    if (sortSelect) sortSelect.value = state.sort;
  };

  const renderResults = () => {
    const base = state.shelf
      ? productsInSubcategory(state.shelf)
      : productsInCategory(category.slug);

    const list = refineProducts(base, state);
    const shelf = category.subcategories.find((s) => s.slug === state.shelf);

    summary.innerHTML = `
      <span class="results__count"><strong>${list.length}</strong>
        ${escapeHtml(list.length === 1 ? t('category.countOne') : t('category.count'))}</span>
      ${shelf ? `<span class="results__shelf">${escapeHtml(pick(shelf, 'en'))}</span>` : ''}
      <span class="shelf-rule" data-shelf-rule aria-hidden="true"></span>`;

    if (!list.length) {
      results.innerHTML = `
        <div class="empty-state empty-state--inline">
          <h2>${escapeHtml(t('category.empty'))}</h2>
          <p>${escapeHtml(t('category.emptyBody'))}</p>
        </div>`;
      return;
    }

    results.replaceChildren(productGrid(list, { eager: 8 }));
    initReveals(results);
    initShelfRules(summary);
  };

  const syncUrl = () => {
    const next = new URLSearchParams({ cat: category.slug });
    if (state.shelf) next.set('shelf', state.shelf);
    window.history.replaceState({}, '', `${window.location.pathname}?${next}`);
  };

  const renderAll = () => {
    renderHead();
    renderTabs();
    renderControls();
    renderResults();
  };

  /* ---------------------------------------------------------------- */

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-shelf]');
    if (!button) return;
    state.shelf = button.dataset.shelf;
    renderTabs();
    renderResults();
    syncUrl();
  });

  controls.addEventListener('change', (event) => {
    if (event.target.matches('[data-brand]')) state.brand = event.target.value;
    if (event.target.matches('[data-sort]')) state.sort = event.target.value;
    renderControls();
    renderResults();
  });

  controls.addEventListener('click', (event) => {
    if (!event.target.closest('[data-clear]')) return;
    state.brand = '';
    state.sort = 'featured';
    renderControls();
    renderResults();
  });

  renderAll();

  return {
    refresh: renderAll,
    destroy: () => icon?.destroy(),
  };
}
