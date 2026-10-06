/**
 * The MySQL connection pool, and the two helpers everything else uses.
 *
 * Every query goes through placeholders (`?`) — values are never built into
 * the SQL string. The pool is kept on globalThis so a warm serverless
 * function reuses its connections instead of opening new ones per request.
 */
import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from '../env.js';

const holder = globalThis as unknown as { __wafiqPool?: Pool };

export function pool(): Pool {
  holder.__wafiqPool ??= mysql.createPool({
    uri: env.databaseUrl,
    /* Always verified. A host with its own authority is trusted by naming
       that authority (DATABASE_CA), never by switching the check off. */
    ssl: env.databaseSsl ? { rejectUnauthorized: true, ca: env.databaseCa } : undefined,
    /* Small: each serverless instance holds its own pool. */
    connectionLimit: 4,
    timezone: 'Z',
    dateStrings: true,
    charset: 'utf8mb4',
  });
  return holder.__wafiqPool;
}

type Params = (string | number | null)[];
type Runner = Pool | PoolConnection;

export async function rows<T = RowDataPacket>(sql: string, params: Params = [], on: Runner = pool()): Promise<T[]> {
  const [result] = await on.query<RowDataPacket[]>(sql, params);
  return result as T[];
}

export async function run(sql: string, params: Params = [], on: Runner = pool()): Promise<ResultSetHeader> {
  const [result] = await on.query<ResultSetHeader>(sql, params);
  return result;
}

/** Runs `work` in a transaction: committed if it returns, rolled back if it throws. */
export async function transaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
