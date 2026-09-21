// Latin subset only — the full files also ship Devanagari, which this
// site never renders.
import '@fontsource/poppins/latin-300.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';

// Every product card carries an Urdu name, so the Arabic regular weight
// is needed in both languages. The bold stays behind the switch below.
import '@fontsource/noto-nastaliq-urdu/arabic-400.css';

import '../styles/tailwind.css';
import '../styles/main.scss';
// Loaded last so its direction-specific overrides win.
import '../styles/rtl.scss';

import { initShell } from './components/shell.js';
import { initSearchPalette } from './components/search-palette.js';
import { initCursor } from './components/cursor.js';
import { initSmoothScroll } from './lib/smooth-scroll.js';
import { initReveals, initShelfRules, initCounters } from './components/reveal.js';
import { getLang, onLangChange, syncDocumentLang, applyTranslations } from './lib/i18n.js';
import { ScrollTrigger } from './lib/gsap-setup.js';
import { initSfxUnlock } from './lib/sfx.js';

/** Page modules are split so a visitor only downloads the page they open. */
const PAGES = {
  home: () => import('./pages/home.js'),
  categories: () => import('./pages/categories.js'),
  category: () => import('./pages/category.js'),
  product: () => import('./pages/product.js'),
  search: () => import('./pages/search.js'),
  branches: () => import('./pages/branches.js'),
  contact: () => import('./pages/contact.js'),
};

/** Nastaliq is a heavy face — only fetch it when Urdu is actually in use. */
let urduFontLoaded = false;
async function ensureUrduFont() {
  if (urduFontLoaded || getLang() !== 'ur') return;
  urduFontLoaded = true;
  await import('@fontsource/noto-nastaliq-urdu/arabic-600.css');
}

/** Re-runs page-level reveals for content that was just rendered. */
export function refreshScene(scope = document) {
  initReveals(scope);
  initShelfRules(scope);
  initCounters(scope);
  ScrollTrigger.refresh();
}

async function boot() {
  syncDocumentLang();
  await ensureUrduFont();

  initSmoothScroll();
  initShell();
  initSearchPalette();
  initCursor();
  initSfxUnlock();

  const name = document.body.dataset.page;
  const load = PAGES[name];

  let page = null;
  if (load) {
    const module = await load();
    page = (await module.default?.()) ?? null;
  }

  refreshScene();
  document.body.classList.add('is-booted');

  onLangChange(async () => {
    await ensureUrduFont();
    applyTranslations();
    await page?.refresh?.();
    refreshScene();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
