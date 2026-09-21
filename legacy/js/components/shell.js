/**
 * Site chrome: header, mobile drawer, footer, scroll progress, back-to-top.
 *
 * Injected by JS so nine HTML pages share one source of truth rather than
 * nine copies that drift apart.
 */
import monogram from '../../assets/logo/monogram.svg?raw';
import logoOnLight from '../../assets/logo/logo-on-light.svg?url';
import logoOnDark from '../../assets/logo/logo-on-dark.svg?url';

import { $, el, escapeHtml, rafThrottle } from '../lib/dom.js';
import { t, toggleLang, getLang, onLangChange, applyTranslations } from '../lib/i18n.js';
import { getTheme, toggleTheme, onThemeChange } from '../lib/theme.js';
import { lockScroll, scrollTo } from '../lib/smooth-scroll.js';
import { totals } from '../lib/data.js';
import { isMuted, toggleMuted } from '../lib/sfx.js';

const NAV = [
  { key: 'nav.home', href: '/index.html', page: 'home' },
  { key: 'nav.categories', href: '/categories.html', page: 'categories' },
  { key: 'nav.branches', href: '/branches.html', page: 'branches' },
  { key: 'nav.about', href: '/about.html', page: 'about' },
  { key: 'nav.contact', href: '/contact.html', page: 'contact' },
];

const ICONS = {
  search: '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  soundOn: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"/>',
  soundOff: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M17 9l6 6M23 9l-6 6"/>',
};

const svgIcon = (name, extraClass = '') =>
  `<svg class="ico ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true">${ICONS[name]}</svg>`;

const isMac = () => /mac/i.test(navigator.platform ?? navigator.userAgent);

/* ------------------------------------------------------------------ *
   Header
 * ------------------------------------------------------------------ */

function buildHeader(page) {
  const header = el('header', { class: 'site-header', id: 'site-header' });

  header.innerHTML = `
    <div class="site-header__inner shell">
      <a class="brand" href="/index.html" aria-label="${escapeHtml(t('brand.name'))}">
        <span class="brand__badge">${monogram}</span>
        <span class="brand__text">
          <span class="brand__name" data-i18n="brand.short">${escapeHtml(t('brand.short'))}</span>
          <span class="brand__sub">Superstores</span>
        </span>
      </a>

      <nav class="site-nav" aria-label="Primary">
        ${NAV.map(
          (item) => `
          <a class="site-nav__link${item.page === page ? ' is-current' : ''}"
             href="${item.href}" data-i18n="${item.key}"
             ${item.page === page ? 'aria-current="page"' : ''}>${escapeHtml(t(item.key))}</a>`,
        ).join('')}
      </nav>

      <div class="site-header__actions">
        <button class="search-trigger" type="button" data-search-open
                aria-label="${escapeHtml(t('nav.search'))}">
          ${svgIcon('search')}
          <span class="search-trigger__label" data-i18n="search.open">${escapeHtml(t('search.open'))}</span>
          <kbd class="search-trigger__kbd">${isMac() ? '⌘' : 'Ctrl'} K</kbd>
        </button>

        <button class="icon-btn" type="button" data-sound-toggle aria-label="">
          <span class="icon-btn__swap icon-btn__swap--sound">
            ${svgIcon('soundOn', 'ico--sound-on')}${svgIcon('soundOff', 'ico--sound-off')}
          </span>
        </button>

        <button class="icon-btn" type="button" data-theme-toggle aria-label="">
          <span class="icon-btn__swap">${svgIcon('sun', 'ico--sun')}${svgIcon('moon', 'ico--moon')}</span>
        </button>

        <button class="lang-toggle" type="button" data-lang-toggle aria-label="">
          <span class="lang-toggle__value"></span>
        </button>

        <button class="icon-btn icon-btn--menu" type="button" data-menu-open
                aria-label="${escapeHtml(t('nav.menu'))}" aria-expanded="false">
          ${svgIcon('menu')}
        </button>
      </div>
    </div>
    <div class="scroll-progress" aria-hidden="true"><span data-progress></span></div>
  `;

  return header;
}

function buildDrawer(page) {
  const drawer = el('div', { class: 'drawer', id: 'drawer', hidden: true });

  drawer.innerHTML = `
    <div class="drawer__scrim" data-menu-close></div>
    <div class="drawer__panel" role="dialog" aria-modal="true"
         aria-label="${escapeHtml(t('nav.menu'))}">
      <div class="drawer__head">
        <span class="brand__badge">${monogram}</span>
        <button class="icon-btn" type="button" data-menu-close
                aria-label="${escapeHtml(t('nav.close'))}">${svgIcon('close')}</button>
      </div>
      <nav class="drawer__nav" aria-label="Mobile">
        ${NAV.map(
          (item, i) => `
          <a class="drawer__link${item.page === page ? ' is-current' : ''}"
             style="--i:${i}" href="${item.href}" data-i18n="${item.key}">${escapeHtml(t(item.key))}</a>`,
        ).join('')}
      </nav>
      <button class="btn btn--ghost drawer__search" type="button" data-search-open>
        ${svgIcon('search')}<span data-i18n="search.open">${escapeHtml(t('search.open'))}</span>
      </button>
      <p class="drawer__note" data-i18n="footer.note">${escapeHtml(t('footer.note'))}</p>
    </div>
  `;

  return drawer;
}

/* ------------------------------------------------------------------ *
   Footer
 * ------------------------------------------------------------------ */

function buildFooter() {
  const footer = el('footer', { class: 'site-footer' });
  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="site-footer__inner shell">
      <div class="site-footer__brand">
        <img class="site-footer__logo" data-theme-logo
             src="${getTheme() === 'dark' ? logoOnDark : logoOnLight}"
             alt="${escapeHtml(t('brand.name'))}" width="220" height="63">
        <p class="site-footer__tagline" data-i18n="footer.tagline">${escapeHtml(t('footer.tagline'))}</p>
        <p class="site-footer__stats">
          ${totals.categories} · ${totals.subcategories} · ${totals.products}
          <span data-i18n="common.products">${escapeHtml(t('common.products'))}</span>
        </p>
      </div>

      <div class="site-footer__cols">
        <div class="site-footer__col">
          <h2 data-i18n="footer.explore">${escapeHtml(t('footer.explore'))}</h2>
          <a href="/categories.html" data-i18n="nav.categories">${escapeHtml(t('nav.categories'))}</a>
          <a href="/search.html" data-i18n="search.open">${escapeHtml(t('search.open'))}</a>
          <a href="/branches.html" data-i18n="nav.branches">${escapeHtml(t('nav.branches'))}</a>
        </div>
        <div class="site-footer__col">
          <h2 data-i18n="footer.company">${escapeHtml(t('footer.company'))}</h2>
          <a href="/about.html" data-i18n="nav.about">${escapeHtml(t('nav.about'))}</a>
          <a href="/contact.html" data-i18n="nav.contact">${escapeHtml(t('nav.contact'))}</a>
        </div>
        <div class="site-footer__col">
          <h2 data-i18n="footer.connect">${escapeHtml(t('footer.connect'))}</h2>
          <a href="https://wafiq.pk" rel="noopener noreferrer" target="_blank">wafiq.pk</a>
          <a href="/contact.html" data-i18n="contact.whatsapp">${escapeHtml(t('contact.whatsapp'))}</a>
        </div>
      </div>
    </div>

    <div class="site-footer__bar shell">
      <p>© ${year} ${escapeHtml(t('brand.name'))}. <span data-i18n="footer.rights">${escapeHtml(t('footer.rights'))}</span></p>
      <p class="site-footer__note" data-i18n="footer.note">${escapeHtml(t('footer.note'))}</p>
    </div>
  `;

  return footer;
}

/* ------------------------------------------------------------------ *
   Wiring
 * ------------------------------------------------------------------ */

function wireHeader(header, drawer) {
  const progress = $('[data-progress]', header);

  const onScroll = rafThrottle(() => {
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > 80);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let lastFocused = null;

  const setDrawer = (open) => {
    drawer.hidden = !open;
    document.body.classList.toggle('has-drawer', open);
    lockScroll(open);
    header.querySelector('[data-menu-open]')?.setAttribute('aria-expanded', String(open));

    if (open) {
      lastFocused = document.activeElement;
      requestAnimationFrame(() => drawer.querySelector('.drawer__link')?.focus());
    } else {
      lastFocused?.focus?.();
    }
  };

  header.querySelector('[data-menu-open]')?.addEventListener('click', () => setDrawer(true));
  for (const node of drawer.querySelectorAll('[data-menu-close]')) {
    node.addEventListener('click', () => setDrawer(false));
  }
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setDrawer(false);
  });
  for (const link of drawer.querySelectorAll('.drawer__link')) {
    link.addEventListener('click', () => setDrawer(false));
  }
}

function wireToggles() {
  const labelTheme = () => {
    const dark = getTheme() === 'dark';
    for (const btn of document.querySelectorAll('[data-theme-toggle]')) {
      btn.setAttribute('aria-label', t(dark ? 'theme.toLight' : 'theme.toDark'));
      btn.setAttribute('aria-pressed', String(dark));
    }
  };

  const labelSound = () => {
    const muted = isMuted();
    for (const btn of document.querySelectorAll('[data-sound-toggle]')) {
      btn.setAttribute('aria-label', t(muted ? 'sound.toOn' : 'sound.toOff'));
      // aria-pressed tracks "is sound on", the opposite of the muted flag —
      // matches how the theme toggle reads "is dark" rather than "is default".
      btn.setAttribute('aria-pressed', String(!muted));
      btn.classList.toggle('is-muted', muted);
    }
  };

  const labelLang = () => {
    const next = getLang() === 'ur' ? 'English' : 'اردو';
    for (const btn of document.querySelectorAll('[data-lang-toggle]')) {
      btn.setAttribute('aria-label', t('lang.label'));
      const value = btn.querySelector('.lang-toggle__value');
      if (value) value.textContent = next;
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-theme-toggle]')) toggleTheme();
    if (event.target.closest('[data-lang-toggle]')) toggleLang();
    if (event.target.closest('[data-sound-toggle]')) {
      toggleMuted();
      labelSound();
    }
  });

  onThemeChange((theme) => {
    labelTheme();
    for (const img of document.querySelectorAll('[data-theme-logo]')) {
      img.src = theme === 'dark' ? logoOnDark : logoOnLight;
    }
  });

  onLangChange(() => {
    labelLang();
    labelTheme();
    labelSound();
  });

  labelTheme();
  labelLang();
  labelSound();
}

function buildBackToTop() {
  const button = el('button', {
    class: 'back-to-top',
    type: 'button',
    'aria-label': t('common.backToTop'),
    html: svgIcon('up'),
  });

  button.addEventListener('click', () => scrollTo(0, { offset: 0 }));

  const onScroll = rafThrottle(() => {
    button.classList.toggle('is-visible', window.scrollY > window.innerHeight);
  });
  window.addEventListener('scroll', onScroll, { passive: true });

  return button;
}

/** Mounts the chrome around whatever `<main>` the page already has. */
export function initShell() {
  const page = document.body.dataset.page ?? '';
  const header = buildHeader(page);
  const drawer = buildDrawer(page);

  const skip = el('a', {
    class: 'skip-link',
    href: '#main',
    'data-i18n': 'nav.skip',
  }, t('nav.skip'));

  document.body.prepend(skip, header, drawer);
  document.body.append(buildFooter(), buildBackToTop());

  wireHeader(header, drawer);
  wireToggles();
  applyTranslations();

  return { header, drawer };
}
