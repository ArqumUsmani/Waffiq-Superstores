/**
 * Server configuration, from the environment.
 *
 * On Vercel these come from the project's Environment Variables. Locally
 * they are read from .env.local (ignored by git) by loadLocalEnv(), which
 * the dev server and the db scripts call first. None of them carry a VITE_
 * prefix, so Vite never ships them to the browser.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadLocalEnv(): void {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match) continue;
      const key = match[1]!;
      if (process.env[key] === undefined) process.env[key] = match[2]!.replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — rely on the real environment */
  }
}

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  get databaseUrl() {
    return need('DATABASE_URL');
  },
  /** Hosted MySQL usually requires TLS; a local one does not offer it. */
  get databaseSsl() {
    return process.env.DATABASE_SSL === '1';
  },
  /**
   * The certificate authority to trust for the database, as base64 of its
   * PEM file. Needed where the host signs with its own authority (Aiven
   * does) rather than a public one. Unset, the system's authorities apply.
   */
  get databaseCa() {
    const encoded = process.env.DATABASE_CA;
    return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : undefined;
  },
  get jwtSecret() {
    const secret = need('JWT_SECRET');
    if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
    return secret;
  },
  get production() {
    return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  },
};
