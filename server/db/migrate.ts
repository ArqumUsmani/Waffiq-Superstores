/**
 * Creates the tables, then brings older databases up to date. Safe to run
 * again: tables are IF NOT EXISTS, and each later change checks first.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../env.js';

loadLocalEnv();
const { pool } = await import('./pool.js');

const sql = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
const statements = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) await pool().query(statement);
console.log(`Applied ${statements.length} statements.`);

/* Changes to tables that already existed when the change was made. */
const has = async (sqlText: string, params: string[]) => {
  const [found] = await pool().query(sqlText, params);
  return (found as unknown[]).length > 0;
};
const hasIndex = (table: string, index: string) =>
  has(
    'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, index],
  );

/* Sign-in by email: one account per address. NULLs (older phone-only accounts) do not collide. */
if (!(await hasIndex('users', 'uq_users_email'))) {
  await pool().query('ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)');
  console.log('users: email is now unique.');
}
/* The sign-in throttle is keyed by whatever was typed, which may now be an email. */
await pool().query('ALTER TABLE login_attempts MODIFY phone VARCHAR(190) NOT NULL');
await pool().end();
