/**
 * Product card — the shape of the reference shots, without the commerce.
 *
 * Where those designs put a price and an "Add to cart" button, this puts
 * the pack size and a View arrow. Wafiq lists stock; it does not sell
 * online, so nothing here should imply a transaction.
 */
import { el, escapeHtml } from '../lib/dom.js';
import { productArtwork } from './product-tile.js';
import { getCategory, getSubcategory } from '../lib/data.js';
import { t, pick, isRtl } from '../lib/i18n.js';

export function productCard(product, { eager = false, index = 0 } = {}) {
  const category = getCategory(product.category);
  const shelf = getSubcategory(product.subcategory);
  const name = isRtl() ? product.nameUr : product.name;
  const secondary = isRtl() ? product.name : product.nameUr;

  const card = el('a', {
    class: 'product-card',
    href: `/product.html?sku=${encodeURIComponent(product.sku)}`,
    dataset: {
      sku: product.sku,
      flipId: `product-${product.sku}`,
      reveal: '',
      revealIndex: String(index),
    },
    'aria-label': `${product.name} — ${t('product.viewProduct')}`,
  });

  card.innerHTML = `
    <span class="product-card__art" style="--aisle:${category?.accent ?? '#136f37'}">
      ${productArtwork(product, { alt: product.name, eager })}
      ${product.tags.includes('popular') ? '<span class="product-card__flag">★</span>' : ''}
    </span>
    <span class="product-card__body">
      <span class="product-card__brand">${escapeHtml(product.brand)}</span>
      <span class="product-card__name">${escapeHtml(name)}</span>
      <span class="product-card__alt" ${isRtl() ? '' : 'lang="ur" dir="rtl"'}>${escapeHtml(secondary)}</span>
      <span class="product-card__shelf">${escapeHtml(pick(shelf ?? {}, 'en'))}</span>
    </span>
    <span class="product-card__foot">
      <span class="pill pill--quiet">${escapeHtml(product.size)}</span>
      <span class="icon-btn icon-btn--sm" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </span>
    </span>
  `;

  // Names the artwork just before navigating so a browser with
  // cross-document view transitions morphs this tile into the product
  // page's hero. Browsers without the API simply navigate.
  card.addEventListener('click', () => {
    const art = card.querySelector('.tile');
    if (art) art.style.viewTransitionName = 'product-art';
  });

  return card;
}

/**
 * A row of cards where the hovered one lifts and its neighbours recede —
 * the "one elevated card" treatment from the references.
 */
export function productRail(products, { id, eager = 0 } = {}) {
  const rail = el('div', { class: 'product-rail', ...(id ? { id } : {}) });

  products.forEach((product, index) => {
    rail.append(productCard(product, { eager: index < eager, index }));
  });

  rail.addEventListener('pointerenter', () => rail.classList.add('is-focused'), true);
  rail.addEventListener('pointerleave', () => rail.classList.remove('is-focused'));

  return rail;
}

/** Plain responsive grid, used on category and search result pages. */
export function productGrid(products, { eager = 0 } = {}) {
  const grid = el('div', { class: 'product-grid' });
  products.forEach((product, index) => {
    grid.append(productCard(product, { eager: index < eager, index }));
  });
  return grid;
}
