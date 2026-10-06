/**
 * The shopping bag — what has been added, shared by every page.
 *
 * It used to be local state on the aisle page, which meant it emptied the
 * moment you left the aisle. The bag now docks in the corner and follows
 * you around the site, so its contents live here.
 *
 * Kept in localStorage as a per-visitor convenience: the bag survives a
 * reload. If storage is unavailable (private mode, blocked site data) the
 * bag simply starts empty each visit.
 */
import { useSyncExternalStore } from 'react';

export interface BagItem {
  /** Stable identity, e.g. "fruits-vegetables:Bananas". */
  key: string;
  name: string;
  /** Photo shown flying into the bag and spilling out of it. */
  image?: string;
  /** Fallback when there is no photo. */
  emoji: string;
  qty: number;
  /** Set when the item is a real product from the catalogue. */
  sku?: string;
  /** Pack size, shown beside the name in the cart. */
  size?: string;
}

/** Fired for every add, so the bag can animate the item in from where it was clicked. */
export interface BagAddEvent {
  item: BagItem;
  /** Where the item's picture was on screen at the click. */
  from: DOMRect | null;
}

const STORAGE_KEY = 'wafiq:bag';

const read = (): BagItem[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.key === 'string' && i.qty > 0) : [];
  } catch {
    return [];
  }
};

let items: BagItem[] = read();
const listeners = new Set<() => void>();
const addListeners = new Set<(event: BagAddEvent) => void>();

function commit(next: BagItem[]): void {
  items = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* private mode — the bag just will not survive a reload */
  }
  listeners.forEach((cb) => cb());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Every item in the bag. Same array identity until the bag changes. */
export function useBag(): BagItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}

/** Total units, counting quantities. */
export const bagCount = (list: BagItem[]): number => list.reduce((sum, i) => sum + i.qty, 0);

/**
 * The live count, outside React. The add event fires before React has
 * re-rendered, so anything reacting to it reads the count from here rather
 * than from a render that is one item behind.
 */
export const currentBagCount = (): number => bagCount(items);

/**
 * Adds one of an item. `from` is the element whose picture should fly into
 * the bag; without it (or under reduced motion) the bag just updates.
 */
export function addToBag(item: Omit<BagItem, 'qty'>, from?: Element | null): void {
  const existing = items.find((i) => i.key === item.key);
  const next = existing
    ? items.map((i) => (i.key === item.key ? { ...i, qty: i.qty + 1 } : i))
    : [...items, { ...item, qty: 1 }];
  commit(next);
  const added = next.find((i) => i.key === item.key)!;
  const event: BagAddEvent = { item: added, from: from?.getBoundingClientRect() ?? null };
  addListeners.forEach((cb) => cb(event));
}

/** Sets how many of an item are in the bag; zero takes it out. */
export function setBagQty(key: string, qty: number): void {
  const wanted = Math.max(0, Math.min(99, Math.floor(qty)));
  commit(
    wanted === 0 ? items.filter((i) => i.key !== key) : items.map((i) => (i.key === key ? { ...i, qty: wanted } : i)),
  );
}

/**
 * With the online store on, only real products can be bought. This clears
 * out the unpriced showcase items a visitor may have added while the site
 * was a listing only.
 */
export function dropUnsellable(): void {
  if (items.some((i) => !i.sku)) commit(items.filter((i) => i.sku));
}

export function emptyBag(): void {
  commit([]);
}

/** For the bag animation: hear about each add as it happens. */
export function onBagAdd(cb: (event: BagAddEvent) => void): () => void {
  addListeners.add(cb);
  return () => {
    addListeners.delete(cb);
  };
}
