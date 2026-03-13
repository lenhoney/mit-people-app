import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

// ── Initialization ──────────────────────────────────────────────────────────

import { runMigrations } from "./migrate";

// Run migrations on startup (idempotent)
const migrationPromise = runMigrations(pool);
migrationPromise.catch((err) => {
  console.error("Failed to run migrations:", err);
});

/** Ensure migrations have completed before accepting queries */
async function ensureMigrated(): Promise<void> {
  await migrationPromise;
}

// ── Query helpers ──────────────────────────────────────────────────────────

/** Run a query and return all rows (replaces db.prepare(sql).all()) */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  await ensureMigrated();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/** Run a query and return the first row or undefined (replaces db.prepare(sql).get()) */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | undefined> {
  await ensureMigrated();
  const result = await pool.query(sql, params);
  return result.rows[0] as T | undefined;
}

/** Run a mutation and return rowCount + rows (replaces db.prepare(sql).run()) */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> {
  await ensureMigrated();
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount ?? 0, rows: result.rows };
}

/** Run a function inside a transaction (replaces db.transaction(fn)()) */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  await ensureMigrated();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Get the raw pool for advanced usage */
export { pool };

// ── Helper functions ────────────────────────────────────────────────────────

/**
 * Cleanup planned work entries that have dates in the past:
 * 1. DELETE entries where planned_end <= today (entirely in the past)
 * 2. UPDATE planned_start to today where planned_start < today (partially in the past)
 */
export async function cleanupPlannedWork(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await execute("DELETE FROM planned_work WHERE planned_end <= $1", [today]);
  await execute(
    "UPDATE planned_work SET planned_start = $1, updated_at = NOW() WHERE planned_start < $2",
    [today, today]
  );
}

/** Get the applicable rate for a person on a given date */
export async function getRate(personId: number, date: string): Promise<number> {
  const row = await queryOne<{ rate: number }>(
    `SELECT rate FROM people_rates
     WHERE person_id = $1 AND $2 >= fy_start AND $2 <= fy_end
     ORDER BY fy_start DESC LIMIT 1`,
    [personId, date]
  );
  return row?.rate ?? 0;
}

/** Get the applicable rate by person name for revenue calculations */
export async function getRateForUser(userName: string, date: string): Promise<number> {
  const row = await queryOne<{ rate: number }>(
    `SELECT pr.rate FROM people_rates pr
     JOIN people p ON pr.person_id = p.id
     WHERE p.person = $1 AND $2 >= pr.fy_start AND $2 <= pr.fy_end
     ORDER BY pr.fy_start DESC LIMIT 1`,
    [userName, date]
  );
  return row?.rate ?? 0;
}

// Gracefully close pool on process exit
process.on("SIGTERM", () => { pool.end().catch(() => {}); });
process.on("SIGINT", () => { pool.end().catch(() => {}); });
