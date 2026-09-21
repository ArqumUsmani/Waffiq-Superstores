import { $, el, escapeHtml } from '../lib/dom.js';
import { categories, countInCategory } from '../lib/data.js';
import { categoryGrid } from '../components/category-card.js';
import { pick, t } from '../lib/i18n.js';

export default function categoriesPage() {
  const host = $('[data-category-grid]');
  const index = $('[data-shelf-index]');
  let icons = [];

  const render = () => {
    for (const icon of icons) icon.destroy();

    const grid = categoryGrid(categories);
    icons = grid.icons;
    host?.replaceChildren(grid.el);

    if (index) {
      index.innerHTML = categories
        .map(
          (category, i) => `
          <section class="shelf-index__group" data-reveal data-reveal-index="${i}"
                   style="--pastel:${category.pastel};--accent:${category.accent}">
            <header class="shelf-index__head">
              <span class="shelf-index__num">${String(i + 1).padStart(2, '0')}</span>
              <h3><a href="/category.html?cat=${encodeURIComponent(category.slug)}">${escapeHtml(pick(category, 'en'))}</a></h3>
              <span class="pill pill--quiet">${countInCategory(category.slug)} ${escapeHtml(t('aisle.products'))}</span>
            </header>
            <ul class="shelf-index__list">
              ${category.subcategories
                .map(
                  (sub) => `
                  <li>
                    <a href="/category.html?cat=${encodeURIComponent(category.slug)}&shelf=${encodeURIComponent(sub.slug)}">
                      ${escapeHtml(pick(sub, 'en'))}
                    </a>
                  </li>`,
                )
                .join('')}
            </ul>
          </section>`,
        )
        .join('');
    }
  };

  render();

  return {
    refresh: render,
    destroy() {
      for (const icon of icons) icon.destroy();
    },
  };
}
