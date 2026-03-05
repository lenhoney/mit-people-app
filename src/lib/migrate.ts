import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

export function runMigrations(db: Database.Database): void {
  // Create tracking table for applied migrations
  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[])
      .map((r) => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

    const applyMigration = db.transaction(() => {
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        db.prepare(statement).run();
      }

      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });

    applyMigration();
    console.log(`Migration applied: ${file}`);
  }
}
