/**
 * The online store's switch, and the live price and stock that go with it.
 *
 * The store is optional. It is switched on from the admin panel, and the
 * site asks once at start-up. Off, unanswered, or failing all mean the same
 * thing here: `enabled` stays false and the site is the listing site it has
 * always been. Nothing in the catalogue pages waits on this.
 */
import { useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { loadUser } from './auth';
import { dropUnsellable } from './bag';

export interface ShopConfig {
  deliveryFee: number;
  freeDeliveryOver: number;
  minOrder: number;
  deliveryAreas: string[];
}

export interface Offer {
  price: number;
  /** Capped by the server: enough to know "plenty", "few" or "none". */
  stock: number;
}

export interface ShopState {
  /** The question has been answered, one way or the other. */
  ready: boolean;
  enabled: boolean;
  config: ShopConfig;
  offers: Record<string, Offer>;
}

const OFF: ShopState = {
  ready: false,
  enabled: false,
  config: { deliveryFee: 0, freeDeliveryOver: 0, minOrder: 0, deliveryAreas: [] },
  offers: {},
};

let state: ShopState = OFF;
const listeners = new Set<() => void>();

function commit(next: ShopState): void {
  state = next;
  listeners.forEach((cb) => cb());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useShop(): ShopState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** The live state, outside React. */
export const currentShop = (): ShopState => state;

/** Price and stock for one product, or null when it is not on sale online. */
export const offerFor = (shop: ShopState, sku: string): Offer | null =>
  shop.enabled ? (shop.offers[sku] ?? null) : null;

/** What delivery costs on a given subtotal — the same rule the server applies. */
export const deliveryFeeFor = (config: ShopConfig, subtotal: number): number =>
  config.freeDeliveryOver > 0 && subtotal >= config.freeDeliveryOver ? 0 : config.deliveryFee;

let loading: Promise<void> | null = null;

/** Asks the API whether the store is on. Safe to call more than once. */
export function loadShop(): Promise<void> {
  loading ??= refreshShop();
  return loading;
}

/** Asks again — after an order, or when a price turned out to be stale. */
export async function refreshShop(): Promise<void> {
  try {
    const config = await api<ShopConfig & { ecommerce: boolean }>('/config', { timeoutMs: 6000 });
    if (!config.ecommerce) {
      commit({ ...OFF, ready: true });
      return;
    }
    const { products } = await api<{ products: Record<string, Offer> }>('/products', { timeoutMs: 8000 });
    /* Anything put in the bag while the site was only a listing has no
       price to charge; it cannot come along to the checkout. */
    dropUnsellable();
    void loadUser();
    commit({
      ready: true,
      enabled: true,
      config: {
        deliveryFee: config.deliveryFee,
        freeDeliveryOver: config.freeDeliveryOver,
        minOrder: config.minOrder,
        deliveryAreas: config.deliveryAreas,
      },
      offers: products,
    });
  } catch {
    commit({ ...OFF, ready: true });
  }
}
