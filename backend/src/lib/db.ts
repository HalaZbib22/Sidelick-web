import pg from "pg";

/**
 * Single shared connection pool. Import `query` for one-off statements
 * or `pool` when you need a transaction (pool.connect()).
 */
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never);
}
