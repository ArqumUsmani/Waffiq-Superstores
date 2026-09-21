/**
 * Two-language chrome (English / Urdu) with a real RTL flip.
 *
 * Markup carries `data-i18n="some.key"` for text and
 * `data-i18n-attr="placeholder:some.key, aria-label:other.key"` for
 * attributes. Product and category names are not handled here — those
 * ship their own `ur` fields in the data files.
 */
import en from '../../i18n/en.json';
import ur from '../../i18n/ur.json';
import { totals } from './data.js';

const DICTS = { en, ur };
const STORAGE_KEY = 'wafiq:lang';
const listeners = new Set();

const read = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

/**
 * Stats copy ("Nine aisles…") would go stale every time a category is
 * added, so strings carry `{{aisles}}` / `{{shelves}}` / `{{products}}` /
 * `{{brands}}` tokens instead of numbers. Passed to every translation —
 * a no-op `replaceAll` for strings that have no tokens.
 */
const STAT_VARS = {
  aisles: totals.categories,
  shelves: totals.subcategories,
  products: totals.products,
  brands: totals.brands,
};

const stored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

let current = stored() === 'ur' ? 'ur' : 'en';

export const getLang = () => current;
export const isRtl = () => current === 'ur';

/**
 * Translates a key, falling back to English and then to the key itself.
 * `vars` fills `{{token}}` placeholders in the result — pass an object to
 * add your own on top of the stats tokens every call already gets.
 */
export function t(key, vars) {
  const raw = read(DICTS[current], key) ?? read(DICTS.en, key) ?? (typeof vars === 'string' ? vars : key);
  if (typeof raw !== 'string') return raw;

  const merged = { ...STAT_VARS, ...(vars && typeof vars === 'object' ? vars : null) };
  return Object.entries(merged).reduce(
    (str, [token, value]) => str.replaceAll(`{{${token}}}`, String(value)),
    raw,
  );
}

/** Picks the right field off a data record: pick(product, 'name') -> name | nameUr. */
export function pick(record, field) {
  if (!record) return '';
  if (current === 'ur') {
    const urField = `${field}Ur`;
    const capitalised = field === 'en' ? 'ur' : urField;
    return record[capitalised] || record[urField] || record[field] || '';
  }
  return record[field] ?? '';
}

export function applyTranslations(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of node.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) node.setAttribute(attr, t(key));
    }
  }
}

export function onLangChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Switches language, direction and font stack, then re-renders the page. */
export function setLang(lang) {
  const next = lang === 'ur' ? 'ur' : 'en';
  if (next === current) return;
  current = next;

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode — the choice just will not persist */
  }

  const root = document.documentElement;
  root.setAttribute('lang', next);
  root.setAttribute('dir', next === 'ur' ? 'rtl' : 'ltr');

  applyTranslations();
  listeners.forEach((cb) => cb(next));
}

export const toggleLang = () => setLang(current === 'ur' ? 'en' : 'ur');

/** Keeps <html> honest when the bootstrap script was skipped (e.g. no JS cache). */
export function syncDocumentLang() {
  const root = document.documentElement;
  root.setAttribute('lang', current);
  root.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
}
