/** Creates the tables. Safe to run again: every statement is IF NOT EXISTS. */
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
await pool().end();
