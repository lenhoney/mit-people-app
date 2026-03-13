import { Pool } from "pg";
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

export async function runMigrations(pool: Pool): Promise<void> {
  // Create tracking table for applied migrations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await pool.query("SELECT name FROM _migrations")).rows.map(
      (r: { name: string }) => r.name
    )
  );

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await client.query(statement);
      }

      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Migration applied: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`Migration failed: ${file}`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
