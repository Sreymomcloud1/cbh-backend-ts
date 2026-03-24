// src/config/db.ts
// PostgreSQL connection pool using node-postgres (pg).
// Connects to the Supabase-managed PostgreSQL database via DATABASE_URL.
// All SQL queries go through this pool — never create standalone clients.

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }   // Required on Railway / Render
    : false,
  max:                    20,
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err: Error) => {
  logger.error('Unexpected DB pool error', { error: err.message });
});

/**
 * Execute a parameterised SQL query.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text:   string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('DB query', { duration: Date.now() - start, rows: result.rowCount, text });
    }
    return result;
  } catch (err) {
    logger.error('DB query error', { text, error: (err as Error).message });
    throw err;
  }
}

/**
 * Get a pool client for transactions.
 * Always call client.release() in a finally block.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { pool };
export default { query, getClient, pool };
