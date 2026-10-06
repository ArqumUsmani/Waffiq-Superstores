/**
 * The bag, priced: what the cart, the open bag and the checkout all show.
 *
 * These totals are for display. The server works every order out again from
 * its own prices and stock, and that is the figure that counts.
 */
import type { BagItem } from '../state/bag';
import type { Offer, ShopState } from '../state/shop';
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

/** A catalogue product as a bag item. */
export const bagItemFor = (product: Product): Omit<BagItem, 'qty'> => ({
  key: `sku:${product.sku}`,
  sku: product.sku,
  name: product.name,
  size: product.size || undefined,
  image: product.image ?? undefined,
  emoji: '🛒',
});
