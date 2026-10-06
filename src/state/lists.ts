/**
 * The signed-in customer's shopping lists — the weekly shop, the monthly
 * stock-up — kept on the server so they follow the account between devices.
 */
import { useSyncExternalStore } from 'react';
import { api } from '../lib/api';

export type Cadence = 'weekly' | 'monthly' | 'none';

export interface ListItem {
  sku: string;
  qty: number;
}

export interface ShoppingList {
  id: number;
  name: string;
  cadence: Cadence;
  items: ListItem[];
}

/** null until asked for (or when nobody is signed in). */
let lists: ShoppingList[] | null = null;
const listeners = new Set<() => void>();

function commit(next: ShoppingList[] | null): void {
  lists = next;
  listeners.forEach((cb) => cb());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useLists(): ShoppingList[] | null {
  return useSyncExternalStore(subscribe, () => lists, () => lists);
}

export async function loadLists(): Promise<void> {
  try {
    commit((await api<{ lists: ShoppingList[] }>('/lists')).lists);
  } catch {
    commit([]);
  }
}

/** Forget them on sign-out, so the next person on this device starts clean. */
export const clearLists = (): void => commit(null);

export async function createList(name: string, cadence: Cadence, items: ListItem[] = []): Promise<number> {
  const { id } = await api<{ id: number }>('/lists', { method: 'POST', body: { name, cadence, items } });
  await loadLists();
  return id;
}

export async function saveList(list: ShoppingList): Promise<void> {
  /* Shown at once; the server copy follows, and is re-read if it is refused. */
  commit((lists ?? []).map((l) => (l.id === list.id ? list : l)));
  try {
    await api(`/lists/${list.id}`, { method: 'PUT', body: { name: list.name, cadence: list.cadence, items: list.items } });
  } catch (error) {
    await loadLists();
    throw error;
  }
}

export async function deleteList(id: number): Promise<void> {
  commit((lists ?? []).filter((l) => l.id !== id));
  await api(`/lists/${id}`, { method: 'DELETE' });
}

/** Puts a product on a list, or adds to the quantity already there. */
export async function addToList(list: ShoppingList, sku: string, qty = 1): Promise<void> {
  const existing = list.items.find((item) => item.sku === sku);
  const items = existing
    ? list.items.map((item) => (item.sku === sku ? { ...item, qty: Math.min(50, item.qty + qty) } : item))
    : [...list.items, { sku, qty }];
  await saveList({ ...list, items });
}
