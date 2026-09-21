import { $, escapeHtml } from '../lib/dom.js';
import { searchAll, products } from '../lib/data.js';
import { productGrid } from '../components/product-card.js';
import { initReveals } from '../components/reveal.js';
import { t, pick } from '../lib/i18n.js';

export default function searchPage() {
  const root = $('[data-search-page]');
  if (!root) return null;

  const input = $('[data-search-input]', root);
  const summary = $('[data-search-summary]', root);
  const results = $('[data-search-results]', root);
  const aisles = $('[data-search-aisles]', root);

  const initial = new URLSearchParams(window.location.search).get('q') ?? '';
  if (input) input.value = initial;

  const render = (query) => {
    const clean = query.trim();

    if (clean.length < 2) {
      summary.textContent = t('search.empty');
      aisles.innerHTML = '';
      results.replaceChildren(productGrid(products.slice(0, 24)));
      initReveals(results);
      return;
    }

    const found = searchAll(clean, 200);
    const matchedProducts = found.filter((r) => r.kind === 'product').map((r) => r.record);
    const matchedAisles = found.filter((r) => r.kind !== 'product');

    summary.innerHTML = `
      <strong>${matchedProducts.length}</strong>
      ${escapeHtml(t('search.count'))} ${escapeHtml(t('search.resultsFor'))}
      <em>“${escapeHtml(clean)}”</em>`;

    aisles.innerHTML = matchedAisles.length
      ? matchedAisles
          .map((item) => {
            const isAisle = item.kind === 'category';
            const record = item.record;
            const href = isAisle
              ? `/category.html?cat=${encodeURIComponent(item.id)}`
              : `/category.html?cat=${encodeURIComponent(record.category.slug)}&shelf=${encodeURIComponent(item.id)}`;
            const swatch = isAisle ? record.pastel : record.category.pastel;
            return `<a class="chip chip--swatch" style="--swatch:${swatch}" href="${href}">${escapeHtml(pick(record, 'en'))}</a>`;
          })
          .join('')
      : '';

    if (!matchedProducts.length) {
      results.innerHTML = `
        <div class="empty-state empty-state--inline">
          <h2>${escapeHtml(t('search.noResults'))}</h2>
          <p>${escapeHtml(t('search.noResultsBody'))}</p>
        </div>`;
      return;
    }

    results.replaceChildren(productGrid(matchedProducts, { eager: 8 }));
    initReveals(results);
  };

  let timer;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const value = input.value;
      const next = value.trim()
        ? `${window.location.pathname}?q=${encodeURIComponent(value.trim())}`
        : window.location.pathname;
      window.history.replaceState({}, '', next);
      render(value);
    }, 140);
  });

  render(initial);

  return { refresh: () => render(input?.value ?? initial) };
}
