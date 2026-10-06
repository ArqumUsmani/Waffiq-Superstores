/**
 * Accounts and sessions.
 *
 * Passwords are stored only as bcrypt hashes. A signed-in session is a JWT
 * in an http-only cookie: page scripts cannot read it, and SameSite=Lax
 * keeps other sites from sending it on a form post. Every protected route
 * re-reads the user from the database, so a role change or a deleted
 * account takes effect at once rather than when the token expires.
 */
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { env } from './env.js';
import { rows, run } from './db/pool.js';

const COOKIE = 'wafiq_session';
const WEEK = 60 * 60 * 24 * 7;
/* Failed sign-ins allowed per phone number per window before a pause. */
const MAX_FAILURES = 8;
const WINDOW_MINUTES = 15;

export interface SessionUser {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: 'customer' | 'admin';
}

export type AppEnv = { Variables: { user: SessionUser } };

const secret = () => new TextEncoder().encode(env.jwtSecret);

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/**
 * Pakistani mobile numbers, in any of the ways people type them
 * (0300 1234567, +92 300 1234567, 923001234567), stored as 03001234567.
 */
export function normalisePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) digits = `0${digits}`;
  return /^03\d{9}$/.test(digits) ? digits : null;
}

/** Lower-cased and trimmed, or null when it is not an email address at all. */
export function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export async function startSession(c: Context, userId: number): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${WEEK}s`)
    .sign(secret());
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: env.production,
    sameSite: 'Lax',
    path: '/',
    maxAge: WEEK,
  });
}

export function endSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/' });
}

export async function currentUser(c: Context): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const found = await rows<SessionUser>('SELECT id, name, phone, email, role FROM users WHERE id = ?', [
      Number(payload.sub),
    ]);
    return found[0] ?? null;
  } catch {
    return null;
  }
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'Please sign in.' }, 401);
  c.set('user', user);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'Please sign in.' }, 401);
  if (user.role !== 'admin') return c.json({ error: 'Admins only.' }, 403);
  c.set('user', user);
  await next();
};

export async function tooManyAttempts(phone: string): Promise<boolean> {
  const found = await rows<{ n: number }>(
    'SELECT COUNT(*) AS n FROM login_attempts WHERE phone = ? AND ok = 0 AND created_at > (UTC_TIMESTAMP() - INTERVAL ? MINUTE)',
    [phone, WINDOW_MINUTES],
  );
  return (found[0]?.n ?? 0) >= MAX_FAILURES;
}

export async function recordAttempt(phone: string, ok: boolean): Promise<void> {
  await run('INSERT INTO login_attempts (phone, ok) VALUES (?, ?)', [phone, ok ? 1 : 0]);
  /* A success clears the slate, so one typo streak is not held against them. */
  if (ok) await run('DELETE FROM login_attempts WHERE phone = ? AND ok = 0', [phone]);
}
