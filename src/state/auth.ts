/**
 * Who is signed in. The session itself is an http-only cookie the page
 * cannot read; this is only what the API says about it.
 */
import { useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { clearLists } from './lists';

export interface User {
  id: number;
  name: string;
  phone: string;
  /** Missing on accounts made before sign-up asked for one. */
  email: string | null;
  role: 'customer' | 'admin';
}

interface AuthState {
  /** Whether the API has been asked yet. */
  ready: boolean;
  user: User | null;
}

let state: AuthState = { ready: false, user: null };
const listeners = new Set<() => void>();

function commit(next: AuthState): void {
  state = next;
  listeners.forEach((cb) => cb());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

let loading: Promise<void> | null = null;

/** Finds out who is signed in, once. */
export function loadUser(): Promise<void> {
  loading ??= api<{ user: User | null }>('/auth/me', { timeoutMs: 8000 }).then(
    ({ user }) => commit({ ready: true, user }),
    () => commit({ ready: true, user: null }),
  );
  return loading;
}

/** `login` is an email address or a mobile number. */
export async function signIn(login: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('/auth/login', { method: 'POST', body: { login, password } });
  commit({ ready: true, user });
  return user;
}

export async function signUp(name: string, email: string, phone: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('/auth/register', { method: 'POST', body: { name, email, phone, password } });
  commit({ ready: true, user });
  return user;
}

/** Asks for a reset link. Always "succeeds": the answer never says whether the address has an account. */
export async function requestReset(email: string): Promise<void> {
  await api('/auth/forgot', { method: 'POST', body: { email } });
}

/** Sets a new password from an emailed link, and signs in. */
export async function resetPassword(token: string, password: string): Promise<User> {
  const { user } = await api<{ user: User }>('/auth/reset', { method: 'POST', body: { token, password } });
  commit({ ready: true, user });
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    clearLists();
    commit({ ready: true, user: null });
  }
}
