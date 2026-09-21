/**
 * The catalogue, plus every query the pages need.
 *
 * All three JSON files are bundled at build time, so the whole site works as
 * static files with no API. Replacing products.json with the real Wafiq
 * catalogue (same schema) is the only change needed for live data.
 */
import categoriesJson from '../data/categories.json';
import productsJson from '../data/products.json';
import branchesJson from '../data/branches.json';
import type {
  Branch,
  Category,
  MatchRange,
  Product,
  SearchResult,
  SortKey,
  SubcategoryWithParent,
} from './types';

export const categories = categoriesJson as Category[];
export const products = productsJson as Product[];
export const branches = branchesJson as Branch[];

const byCategorySlug = new Map(categories.map((c) => [c.slug, c]));
const bySku = new Map(products.map((p) => [p.sku, p]));

const subIndex = new Map<string, SubcategoryWithParent>();
for (const cat of categories) {
  for (const sub of cat.subcategories) subIndex.set(sub.slug, { ...sub, category: cat });
}

export const getCategory = (slug: string | undefined): Category | null =>
  (slug && byCategorySlug.get(slug)) || null;
export const getSubcategory = (slug: string | undefined): SubcategoryWithParent | null =>
  (slug && subIndex.get(slug)) || null;
export const getProduct = (sku: string | undefined): Product | null =>
  (sku && bySku.get(sku)) || null;

export const productsInCategory = (slug: string): Product[] =>
  products.filter((p) => p.category === slug);
export const productsInSubcategory = (slug: string): Product[] =>
  products.filter((p) => p.subcategory === slug);

export const countInCategory = (slug: string): number => productsInCategory(slug).length;
export const countInSubcategory = (slug: string): number => productsInSubcategory(slug).length;

export const allBrands: string[] = [...new Set(products.map((p) => p.brand))].sort((a, b) =>
  a.localeCompare(b),
);

export const brandsInCategory = (slug: string): string[] =>
  [...new Set(productsInCategory(slug).map((p) => p.brand))].sort((a, b) => a.localeCompare(b));

/** Everything tagged `popular`, in catalogue order. */
export const popularProducts = (limit = 10): Product[] =>
  products.filter((p) => p.tags.includes('popular')).slice(0, limit);

/** Same shelf first, then same aisle, never the product itself. */
export function relatedProducts(product: Product | null, limit = 6): Product[] {
  if (!product) return [];
  const sameShelf = products.filter(
    (p) => p.subcategory === product.subcategory && p.sku !== product.sku,
  );
  const sameAisle = products.filter(
    (p) => p.category === product.category && p.subcategory !== product.subcategory,
  );
  return [...sameShelf, ...sameAisle].slice(0, limit);
}

export const totals = {
  categories: categories.length,
  subcategories: subIndex.size,
  products: products.length,
  brands: allBrands.length,
};

/* ------------------------------------------------------------------ *
   Search
 * ------------------------------------------------------------------ */

const normalise = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '');

interface FieldScore extends MatchRange {
  score: number;
}

/**
 * Scores one haystack against the query.
 * Exact prefix beats word-start beats substring beats subsequence, so
 * typing "tapa" surfaces Tapal before anything that merely contains those
 * letters in order.
 */
function scoreField(haystack: string, needle: string): FieldScore | null {
  const index = haystack.indexOf(needle);

  if (index === 0) return { score: 100, start: 0, end: needle.length };
  if (index > 0) {
    const isWordStart = /[\s-]/.test(haystack[index - 1]!);
    return { score: isWordStart ? 80 : 55, start: index, end: index + needle.length };
  }

  // Subsequence fallback — catches typos like "biscts".
  //
  // Kept deliberately strict: short queries subsequence-match almost
  // anything, and a loose match ("tapa" inside "Mortein Cockroach") is
  // noise rather than a result. So it needs at least four characters, a
  // first hit on a word boundary, and a span close to the query length.
  if (needle.length < 4) return null;

  let cursor = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < haystack.length && cursor < needle.length; i += 1) {
    if (haystack[i] !== needle[cursor]) continue;
    if (first < 0) first = i;
    last = i;
    cursor += 1;
  }
  if (cursor < needle.length) return null;
  if (first > 0 && !/[\s-]/.test(haystack[first - 1]!)) return null;
  if (last - first + 1 > needle.length * 1.8) return null;

  return { score: Math.max(10, 30 - first), start: -1, end: -1 };
}

/**
 * Searches products, aisles and shelves at once.
 * Each result carries the match range so the UI can highlight it.
 */
export function searchAll(rawQuery: string, limit = 12): SearchResult[] {
  const needle = normalise(rawQuery.trim());
  if (needle.length < 2) return [];

  const results: SearchResult[] = [];

  for (const product of products) {
    const name = scoreField(normalise(product.name), needle);
    const brand = scoreField(normalise(product.brand), needle);
    const best = [name, brand].filter((x): x is FieldScore => x !== null).sort(
      (a, b) => b.score - a.score,
    )[0];
    if (!best) continue;

    results.push({
      kind: 'product',
      id: product.sku,
      record: product,
      score: best.score + (product.tags.includes('popular') ? 8 : 0) + (best === name ? 6 : 0),
      match: best === name ? best : null,
    });
  }

  for (const cat of categories) {
    const hit = scoreField(normalise(cat.en), needle);
    if (hit) {
      results.push({ kind: 'category', id: cat.slug, record: cat, score: hit.score + 20, match: hit });
    }

    for (const sub of cat.subcategories) {
      const subHit = scoreField(normalise(sub.en), needle);
      if (subHit) {
        results.push({
          kind: 'subcategory',
          id: sub.slug,
          record: { ...sub, category: cat },
          score: subHit.score + 12,
          match: subHit,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Filters + sorts a product list for the category page. */
export function refineProducts(
  list: Product[],
  { brand = '', sort = 'featured' as SortKey } = {},
): Product[] {
  const out = brand ? list.filter((p) => p.brand === brand) : [...list];

  if (sort === 'az') out.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'za') out.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === 'brand') {
    out.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
  } else {
    out.sort((a, b) => Number(b.tags.includes('popular')) - Number(a.tags.includes('popular')));
  }
  return out;
}
