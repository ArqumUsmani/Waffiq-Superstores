/**
 * Shop settings, stored as key/value rows so the admin panel can change
 * them without a deploy. Anything missing from the table falls back to the
 * defaults here — in particular the store starts switched off.
 */
import { rows, run } from './db/pool.js';

export interface ShopSettings {
  /** The master switch. Off: the website is the plain catalogue it was. */
  ecommerce: boolean;
  deliveryFee: number;
  /** Orders at or above this are delivered free. 0 disables the offer. */
  freeDeliveryOver: number;
  minOrder: number;
  deliveryAreas: string[];
}

export const DEFAULTS: ShopSettings = {
  ecommerce: false,
  deliveryFee: 150,
  freeDeliveryOver: 3000,
  minOrder: 500,
  deliveryAreas: ['Gulberg Greens', 'Gulberg Residencia', 'Gulberg Business Square', 'Ghauri Town', 'Koral Town'],
};

export async function getSettings(): Promise<ShopSettings> {
  const stored = await rows<{ k: string; v: string }>('SELECT k, v FROM settings');
  const map = new Map(stored.map((row) => [row.k, row.v]));
  const num = (key: string, fallback: number) => {
    const value = Number(map.get(key));
    return Number.isFinite(value) && map.has(key) ? value : fallback;
  };
  let areas = DEFAULTS.deliveryAreas;
  try {
    const parsed = JSON.parse(map.get('delivery_areas') ?? 'null');
    if (Array.isArray(parsed) && parsed.every((a) => typeof a === 'string')) areas = parsed;
  } catch {
    /* keep the defaults */
  }
  return {
    ecommerce: map.get('ecommerce_enabled') === '1',
    deliveryFee: num('delivery_fee', DEFAULTS.deliveryFee),
    freeDeliveryOver: num('free_delivery_over', DEFAULTS.freeDeliveryOver),
    minOrder: num('min_order', DEFAULTS.minOrder),
    deliveryAreas: areas,
  };
}

export async function saveSettings(next: ShopSettings): Promise<void> {
  const entries: [string, string][] = [
    ['ecommerce_enabled', next.ecommerce ? '1' : '0'],
    ['delivery_fee', String(next.deliveryFee)],
    ['free_delivery_over', String(next.freeDeliveryOver)],
    ['min_order', String(next.minOrder)],
    ['delivery_areas', JSON.stringify(next.deliveryAreas)],
  ];
  for (const [k, v] of entries) {
    await run('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [k, v]);
  }
}

/** What an order of this size costs to deliver. */
export const deliveryFeeFor = (settings: ShopSettings, subtotal: number): number =>
  settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver ? 0 : settings.deliveryFee;
