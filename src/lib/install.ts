/**
 * "Add to home screen", for the installable site.
 *
 * Android and desktop Chrome hand the page an event it can use to offer
 * installation; it has to be caught when it fires, long before any button
 * exists. iOS has no such event — there the visitor has to use Safari's
 * Share menu, so all we can do is say so.
 */
import { useSyncExternalStore } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** The browser will show its install dialog if asked. */
  ready: boolean;
  /** iOS Safari, not yet on the home screen: manual steps only. */
  ios: boolean;
  /** Already running from the home screen. */
  installed: boolean;
}

const standalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

let pending: InstallEvent | null = null;
let state: InstallState = { ready: false, ios: false, installed: false };
const listeners = new Set<() => void>();

function commit(next: InstallState): void {
  state = next;
  listeners.forEach((cb) => cb());
}

export function initInstall(): void {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone();
  commit({ ready: false, ios, installed: standalone() });
  window.addEventListener('beforeinstallprompt', (event) => {
    /* Held back so it can be offered at a sensible moment instead. */
    event.preventDefault();
    pending = event as InstallEvent;
    commit({ ...state, ready: true });
  });
  window.addEventListener('appinstalled', () => {
    pending = null;
    commit({ ready: false, ios: false, installed: true });
  });
}

export async function promptInstall(): Promise<void> {
  if (!pending) return;
  const event = pending;
  pending = null;
  commit({ ...state, ready: false });
  await event.prompt();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useInstall(): InstallState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
