/**
 * Global search palette (Cmd/Ctrl+K).
 *
 * Searches products, aisles and shelves at once, highlights the matched
 * span, and is fully keyboard driven. Everything runs client-side over
 * the bundled catalogue — there is no request to make.
 */
import { $, el, escapeHtml } from '../lib/dom.js';
import { searchAll, getCategory } from '../lib/data.js';
import { productArtwork } from './product-tile.js';
import { t, isRtl } from '../lib/i18n.js';
import { lockScroll } from '../lib/smooth-scroll.js';
import { motion } from '../lib/motion-guard.js';

const RECENT_KEY = 'wafiq:recent-searches';
const MAX_RECENT = 5;

const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
};

const writeRecent = (list) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* private mode — history just will not persist */
  }
};

/** Wraps the matched range so the hit is visible without re-searching. */
function highlight(text, match) {
  if (!match || match.start < 0) return escapeHtml(text);
  return (
    escapeHtml(text.slice(0, match.start)) +
    `<mark>${escapeHtml(text.slice(match.start, match.end))}</mark>` +
    escapeHtml(text.slice(match.end))
  );
}

function hrefFor(result) {
  if (result.kind === 'product') return `/product.html?sku=${encodeURIComponent(result.id)}`;
  if (result.kind === 'category') return `/category.html?cat=${encodeURIComponent(result.id)}`;
  return `/category.html?cat=${encodeURIComponent(result.record.category.slug)}&shelf=${encodeURIComponent(result.id)}`;
}

function rowFor(result) {
  const aisleName = (slug) => getCategory(slug)?.en ?? '';

  if (result.kind === 'product') {
    const product = result.record;
    return `
      <a class="palette__row" href="${hrefFor(result)}" role="option" tabindex="-1">
        <span class="palette__art">${productArtwork(product, { alt: product.name })}</span>
        <span class="palette__text">
          <span class="palette__title">${highlight(product.name, result.match)}</span>
          <span class="palette__meta">${escapeHtml(product.brand)} · ${escapeHtml(product.size)} · ${escapeHtml(aisleName(product.category))}</span>
        </span>
        <span class="palette__kind">${escapeHtml(t('common.products'))}</span>
      </a>`;
  }

  const isAisle = result.kind === 'category';
  const record = result.record;
  const swatch = isAisle ? record.pastel : record.category.pastel;
  const label = isAisle ? t('aisle.eyebrow') : t('category.shelves');
  const meta = isAisle
    ? `${record.subcategories.length} ${t('aisle.shelves')}`
    : aisleName(record.category.slug);

  return `
    <a class="palette__row" href="${hrefFor(result)}" role="option" tabindex="-1">
      <span class="palette__art palette__art--swatch" style="--swatch:${swatch}"></span>
      <span class="palette__text">
        <span class="palette__title">${highlight(record.en, result.match)}</span>
        <span class="palette__meta">${escapeHtml(meta)}</span>
      </span>
      <span class="palette__kind">${escapeHtml(label)}</span>
    </a>`;
}

export function initSearchPalette() {
  const root = el('div', { class: 'palette', id: 'search-palette', hidden: true });

  root.innerHTML = `
    <div class="palette__scrim" data-palette-close></div>
    <div class="palette__panel" role="dialog" aria-modal="true"
         aria-label="${escapeHtml(t('search.title'))}">
      <div class="palette__field">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" aria-hidden="true">
          <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3"/>
        </svg>
        <input class="palette__input" type="search" autocomplete="off" spellcheck="false"
               role="combobox" aria-expanded="true" aria-controls="palette-results"
               aria-label="${escapeHtml(t('search.title'))}"
               placeholder="${escapeHtml(t('search.placeholder'))}">
        <button class="pill pill--quiet" type="button" data-palette-close>Esc</button>
      </div>
      <div class="palette__results" id="palette-results" role="listbox"
           aria-label="${escapeHtml(t('search.title'))}"></div>
      <div class="palette__foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> ${escapeHtml(t('search.hintNav'))}</span>
        <span><kbd>↵</kbd> ${escapeHtml(t('search.hintOpen'))}</span>
        <span><kbd>esc</kbd> ${escapeHtml(t('search.hintClose'))}</span>
      </div>
    </div>
  `;

  document.body.append(root);

  const input = $('.palette__input', root);
  const results = $('.palette__results', root);

  let open = false;
  let active = -1;
  let rows = [];
  let lastFocused = null;

  const renderRecent = () => {
    const recent = readRecent();
    if (!recent.length) {
      results.innerHTML = `<p class="palette__empty">${escapeHtml(t('search.empty'))}</p>`;
      rows = [];
      return;
    }
    results.innerHTML = `
      <div class="palette__section">
        <h3>${escapeHtml(t('search.recent'))}</h3>
        <button type="button" data-clear-recent>${escapeHtml(t('search.clearRecent'))}</button>
      </div>
      ${recent
        .map(
          (term) =>
            `<button class="palette__row palette__row--term" type="button" data-term="${escapeHtml(term)}">
               <span class="palette__art palette__art--swatch" style="--swatch:var(--color-lime)"></span>
               <span class="palette__text"><span class="palette__title">${escapeHtml(term)}</span></span>
             </button>`,
        )
        .join('')}
    `;
    rows = [...results.querySelectorAll('.palette__row')];
    active = -1;
  };

  const render = (query) => {
    if (query.trim().length < 2) {
      renderRecent();
      return;
    }

    const found = searchAll(query, 14);
    if (!found.length) {
      results.innerHTML = `
        <p class="palette__empty">
          <strong>${escapeHtml(t('search.noResults'))}</strong>
          <span>${escapeHtml(t('search.noResultsBody'))}</span>
        </p>`;
      rows = [];
      active = -1;
      return;
    }

    results.innerHTML =
      found.map(rowFor).join('') +
      `<a class="palette__all" href="/search.html?q=${encodeURIComponent(query)}">
         ${escapeHtml(t('search.seeAll'))} →
       </a>`;

    rows = [...results.querySelectorAll('.palette__row, .palette__all')];
    active = 0;
    paint();
  };

  const paint = () => {
    rows.forEach((row, i) => {
      const on = i === active;
      row.classList.toggle('is-active', on);
      row.setAttribute('aria-selected', String(on));
      if (on) row.scrollIntoView({ block: 'nearest' });
    });
  };

  const move = (delta) => {
    if (!rows.length) return;
    active = (active + delta + rows.length) % rows.length;
    paint();
  };

  const remember = (term) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    writeRecent([clean, ...readRecent().filter((x) => x !== clean)]);
  };

  const setOpen = (next) => {
    if (next === open) return;
    open = next;
    root.hidden = !next;
    document.body.classList.toggle('has-palette', next);
    lockScroll(next);

    if (next) {
      lastFocused = document.activeElement;
      input.value = '';
      renderRecent();
      requestAnimationFrame(() => input.focus());
    } else {
      lastFocused?.focus?.();
    }
  };

  input.addEventListener('input', () => render(input.value));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      const row = rows[active];
      if (!row) return;
      event.preventDefault();
      remember(input.value);
      if (row.dataset.term) {
        input.value = row.dataset.term;
        render(input.value);
      } else {
        window.location.href = row.href;
      }
    } else if (event.key === 'Tab') {
      // Keep focus inside the dialog.
      event.preventDefault();
      input.focus();
    }
  });

  results.addEventListener('click', (event) => {
    const term = event.target.closest('[data-term]');
    if (term) {
      input.value = term.dataset.term;
      input.focus();
      render(input.value);
      return;
    }
    if (event.target.closest('[data-clear-recent]')) {
      writeRecent([]);
      renderRecent();
      return;
    }
    const row = event.target.closest('.palette__row, .palette__all');
    if (row) remember(input.value);
  });

  for (const node of root.querySelectorAll('[data-palette-close]')) {
    node.addEventListener('click', () => setOpen(false));
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-search-open]')) {
      event.preventDefault();
      setOpen(true);
    }
  });

  document.addEventListener('keydown', (event) => {
    const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (combo) {
      event.preventDefault();
      setOpen(!open);
      return;
    }
    // "/" opens search, but not while the visitor is typing somewhere else.
    if (event.key === '/' && !open) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      event.preventDefault();
      setOpen(true);
    }
  });

  // Direction affects nothing here but the arrow glyph in the footer hint.
  if (isRtl()) root.setAttribute('dir', 'rtl');
  if (motion.reduced) root.classList.add('is-plain');

  return { open: () => setOpen(true), close: () => setOpen(false) };
}
