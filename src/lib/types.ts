/** Shapes of the bundled catalogue data. */

export interface Subcategory {
  slug: string;
  en: string;
  ur: string;
}

/** A subcategory with its parent attached, as the lookups return it. */
export interface SubcategoryWithParent extends Subcategory {
  category: Category;
}

export interface Category {
  slug: string;
  en: string;
  ur: string;
  blurbEn: string;
  blurbUr: string;
  /** Soft background tint for the aisle, injected as --pastel. */
  pastel: string;
  /** Saturated partner to `pastel`, injected as --accent. */
  accent: string;
  glyph: string;
  subcategories: Subcategory[];
  /** Opt-in interactive artwork. Unset on every record today. */
  scene?: string;
}

export interface Product {
  sku: string;
  name: string;
  nameUr: string;
  brand: string;
  /** Category slug. */
  category: string;
  /** Subcategory slug. */
  subcategory: string;
  size: string;
  desc: string;
  tags: string[];
  /** Input to the build-time tile rasteriser; not read at runtime. */
  tile: { hue: number; glyph: string };
  image: string | null;
}

export interface BranchHours {
  day: string;
  dayUr: string;
  open: string;
}

export interface Branch {
  id: string;
  name: string;
  nameUr: string;
  address: string;
  city: string;
  hoursSummary: string;
  hours: BranchHours[];
  phone: string | null;
  maps: string;
  flagship: boolean;
  placeholder: boolean;
  embed: string;
}

/* ------------------------------------------------------------------ *
   Aisle items — the priced shortlist shown on an aisle page.

   Deliberately separate from `Product`: the 202-record catalogue is a
   price-free stock listing, and mixing invented prices into it would
   poison that data. These are display-only.
 * ------------------------------------------------------------------ */

export interface AisleItem {
  name: string;
  emoji: string;
  /** Whole rupees. */
  price: number;
  unit: string;
  tag?: string;
}

export interface Aisle {
  /** Matches a Category slug. */
  slug: string;
  emoji: string;
  from: string;
  to: string;
  items: AisleItem[];
}

/* ------------------------------------------------------------------ *
   Search
 * ------------------------------------------------------------------ */

/** The matched span within the field that scored, for highlighting. */
export interface MatchRange {
  start: number;
  end: number;
}

interface SearchHit<K extends string, R> {
  kind: K;
  id: string;
  record: R;
  score: number;
  match: MatchRange | null;
}

export type SearchResult =
  | SearchHit<'product', Product>
  | SearchHit<'category', Category>
  | SearchHit<'subcategory', SubcategoryWithParent>;

export type SortKey = 'featured' | 'az' | 'za' | 'brand';
