/**
 * Two-language chrome (English / Urdu) with a real RTL flip.
 *
 * `applyTranslations()` from the vanilla build is deliberately gone. It
 * walked [data-i18n] nodes and assigned textContent, which in React means
 * mutating nodes the reconciler owns. Components call `t()` directly and
 * re-render through LangProvider instead — there should be no `data-i18n`
 * attribute anywhere in the JSX.
 *
 * Product and category names are not handled here — those ship their own
 * `ur` fields in the data files and go through `pick()`.
 */
import en from '../i18n/en.json';
import ur from '../i18n/ur.json';
import { totals } from './data';

export type Lang = 'en' | 'ur';

type Dict = typeof en;
type LangListener = (lang: Lang) => void;

const DICTS: Record<Lang, Dict> = { en, ur: ur as Dict };
const STORAGE_KEY = 'wafiq:lang';
const listeners = new Set<LangListener>();

const read = (dict: Dict, key: string): unknown =>
  key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    dict,
  );

/**
 * Stats copy ("Ten aisles…") would go stale every time a category is added,
 * so strings carry `{{aisles}}` / `{{shelves}}` / `{{products}}` /
 * `{{brands}}` tokens instead of numbers. Passed to every translation — a
 * no-op replaceAll for strings that have no tokens.
 */
const STAT_VARS: Record<string, string | number> = {
  aisles: totals.categories,
  shelves: totals.subcategories,
  products: totals.products,
  brands: totals.brands,
};

const stored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

let current: Lang = stored() === 'ur' ? 'ur' : 'en';

export const getLang = (): Lang => current;
export const isRtl = (): boolean => current === 'ur';

/**
 * Translates a key, falling back to English and then to the key itself.
 * `vars` fills `{{token}}` placeholders — pass an object to add your own on
 * top of the stats tokens every call already gets, or a string to use as
 * the fallback when the key is missing.
 */
export function t(key: string, vars?: Record<string, string | number> | string): string {
  const found = read(DICTS[current], key) ?? read(DICTS.en, key);
  const raw = typeof found === 'string' ? found : typeof vars === 'string' ? vars : key;

  const merged = { ...STAT_VARS, ...(vars && typeof vars === 'object' ? vars : null) };
  return Object.entries(merged).reduce(
    (str, [token, value]) => str.replaceAll(`{{${token}}}`, String(value)),
    raw,
  );
}

/**
 * Picks the right field off a data record: pick(product, 'name') gives
 * `name` in English and `nameUr` in Urdu.
 *
 * Note the special case: `pick(category, 'en')` reads `ur`, because the
 * category records name their two language fields `en` / `ur` rather than
 * `x` / `xUr`. Every other field follows the `${field}Ur` convention.
 */
export function pick(record: Record<string, unknown> | null | undefined, field: string): string {
  if (!record) return '';

  if (current === 'ur') {
    const urField = `${field}Ur`;
    const key = field === 'en' ? 'ur' : urField;
    const value = record[key] ?? record[urField] ?? record[field];
    return typeof value === 'string' ? value : '';
  }

  const value = record[field];
  return typeof value === 'string' ? value : '';
}

export function onLangChange(callback: LangListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Subscribe shape for useSyncExternalStore. */
export const subscribeLang = (notify: () => void): (() => void) => onLangChange(notify);

/** Switches language and direction, then notifies subscribers to re-render. */
export function setLang(lang: Lang): void {
  const next: Lang = lang === 'ur' ? 'ur' : 'en';
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

  listeners.forEach((cb) => cb(next));
}

export const toggleLang = (): void => setLang(current === 'ur' ? 'en' : 'ur');

/** Keeps <html> honest when the bootstrap script was skipped. */
export function syncDocumentLang(): void {
  const root = document.documentElement;
  root.setAttribute('lang', current);
  root.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
}
