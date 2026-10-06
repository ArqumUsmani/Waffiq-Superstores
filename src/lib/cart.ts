/**
 * The bag, priced: what the cart, the open bag and the checkout all show.
 *
 * These totals are for display. The server works every order out again from
 * its own prices and stock, and that is the figure that counts.
 */
import type { BagItem } from '../state/bag';
import type { Offer, ShopState } from '../state/shop';
import { getProduct, productsInCategory, productsInSubcategory } from './data';
import type { Product } from './types';

export interface CartLine {
  item: BagItem;
  offer: Offer | null;
  /** How many can be bought right now; zero when it is gone. */
  max: number;
  /** In stock, in the quantity asked for. */
  ok: boolean;
  total: number;
}

export interface Cart {
  lines: CartLine[];
  units: number;
  subtotal: number;
  /** Something has sold out or run short since it was added. */
  blocked: boolean;
}

export function priceCart(bag: BagItem[], shop: ShopState): Cart {
  const lines = bag
    .filter((item) => item.sku)
    .map((item): CartLine => {
      const offer = shop.offers[item.sku!] ?? null;
      const max = offer?.stock ?? 0;
      const ok = max > 0 && item.qty <= max;
      return { item, offer, max, ok, total: ok && offer ? offer.price * item.qty : 0 };
    });
  return {
    lines,
    units: lines.reduce((sum, line) => sum + line.item.qty, 0),
    subtotal: lines.reduce((sum, line) => sum + line.total, 0),
    blocked: lines.some((line) => !line.ok),
  };
}

/**
 * What to offer instead of a product that cannot be bought right now: the
 * closest things in stock from the same shelf (then the same aisle), nearest
 * in price first.
 */
export function alternativesFor(sku: string, shop: ShopState, limit = 3): Product[] {
  const product = getProduct(sku);
  if (!product || !shop.enabled) return [];
  const price = shop.offers[sku]?.price ?? null;
  const inStock = (p: Product) => p.sku !== sku && (shop.offers[p.sku]?.stock ?? 0) > 0;
  const nearest = (a: Product, b: Product) =>
    price === null ? 0 : Math.abs(shop.offers[a.sku]!.price - price) - Math.abs(shop.offers[b.sku]!.price - price);
  const shelf = productsInSubcategory(product.subcategory).filter(inStock).sort(nearest);
  if (shelf.length >= limit) return shelf.slice(0, limit);
  const aisle = productsInCategory(product.category)
    .filter((p) => inStock(p) && p.subcategory !== product.subcategory)
    .sort(nearest);
  return [...shelf, ...aisle].slice(0, limit);
}

/** Splits wanted items into what can go in the bag now and what cannot. */
export function splitByStock(wanted: { sku: string; qty: number }[], shop: ShopState) {
  const ready: { product: Product; qty: number }[] = [];
  const missing: Product[] = [];
  for (const { sku, qty } of wanted) {
    const product = getProduct(sku);
    if (!product) continue;
    const stock = shop.offers[sku]?.stock ?? 0;
    if (stock > 0) ready.push({ product, qty: Math.min(qty, stock) });
    else missing.push(product);
  }
  return { ready, missing };
}

/** A catalogue product as a bag item. */
export const bagItemFor = (product: Product): Omit<BagItem, 'qty'> => ({
  key: `sku:${product.sku}`,
  sku: product.sku,
  name: product.name,
  size: product.size || undefined,
  image: product.image ?? undefined,
  emoji: '🛒',
});
