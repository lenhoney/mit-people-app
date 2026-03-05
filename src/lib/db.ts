import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrate";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "mit-people.db");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Remove stale WAL/SHM files that cause hangs after a hard kill
const walPath = DB_PATH + "-wal";
const shmPath = DB_PATH + "-shm";
if (fs.existsSync(shmPath)) {
  try {
    const tempDb = new Database(DB_PATH);
    tempDb.pragma("wal_checkpoint(TRUNCATE)");
    tempDb.close();
  } catch {
    try { fs.unlinkSync(walPath); } catch { /* ignore */ }
    try { fs.unlinkSync(shmPath); } catch { /* ignore */ }
  }
}

// Use globalThis to persist the db instance across Next.js hot-reloads
const globalForDb = globalThis as unknown as { __db?: Database.Database };

function createDb(): Database.Database {
  const db = new Database(DB_PATH);

  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person TEXT UNIQUE NOT NULL,
      sow TEXT,
      role TEXT,
      kerb TEXT,
      managed_services INTEGER DEFAULT 0,
      architecture INTEGER DEFAULT 0,
      app_support INTEGER DEFAULT 0,
      computing INTEGER DEFAULT 0,
      phone TEXT,
      work_anniversary TEXT,
      birthday TEXT,
      manager_name TEXT,
      business_unit TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS people_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      fy_start TEXT NOT NULL,
      fy_end TEXT NOT NULL,
      fy_label TEXT NOT NULL,
      rate REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(person_id, fy_label),
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timesheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_starts_on TEXT NOT NULL,
      category TEXT,
      user_name TEXT NOT NULL,
      task_description TEXT,
      task_number TEXT,
      state TEXT,
      sunday REAL DEFAULT 0,
      monday REAL DEFAULT 0,
      tuesday REAL DEFAULT 0,
      wednesday REAL DEFAULT 0,
      thursday REAL DEFAULT 0,
      friday REAL DEFAULT 0,
      saturday REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(week_starts_on, user_name, task_number)
    );

    CREATE TABLE IF NOT EXISTS planned_work (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      task_number TEXT NOT NULL,
      task_description TEXT,
      planned_start TEXT NOT NULL,
      planned_end TEXT NOT NULL,
      allocation_pct INTEGER NOT NULL DEFAULT 100,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(person_id, task_number),
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_number TEXT UNIQUE NOT NULL,
      task_description TEXT,
      group_label TEXT,
      budget REAL,
      status TEXT DEFAULT 'Started',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_task_number ON projects(task_number);
    CREATE INDEX IF NOT EXISTS idx_projects_group_label ON projects(group_label);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

    CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets(user_name);
    CREATE INDEX IF NOT EXISTS idx_timesheets_week ON timesheets(week_starts_on);
    CREATE INDEX IF NOT EXISTS idx_timesheets_category ON timesheets(category);
    CREATE INDEX IF NOT EXISTS idx_timesheets_task ON timesheets(task_number);
    CREATE INDEX IF NOT EXISTS idx_people_person ON people(person);
    CREATE INDEX IF NOT EXISTS idx_people_rates_person ON people_rates(person_id);
    CREATE INDEX IF NOT EXISTS idx_people_rates_fy ON people_rates(fy_start, fy_end);
    CREATE INDEX IF NOT EXISTS idx_planned_work_person ON planned_work(person_id);
    CREATE INDEX IF NOT EXISTS idx_planned_work_task ON planned_work(task_number);

    CREATE TABLE IF NOT EXISTS personal_time_off (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER,
      person_name TEXT,
      kerb TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Personal',
      leave_status TEXT,
      country TEXT,
      message TEXT,
      business_days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(kerb, start_date, end_date, type),
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pto_person ON personal_time_off(person_id);
    CREATE INDEX IF NOT EXISTS idx_pto_dates ON personal_time_off(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_pto_type ON personal_time_off(type);
    CREATE INDEX IF NOT EXISTS idx_pto_kerb ON personal_time_off(kerb);

    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Migrations ──────────────────────────────────────────────────────────
  // Add allocation_pct column if it doesn't exist yet
  const pwColumns = db.prepare("PRAGMA table_info(planned_work)").all() as { name: string }[];
  if (!pwColumns.some((c) => c.name === "allocation_pct")) {
    db.exec("ALTER TABLE planned_work ADD COLUMN allocation_pct INTEGER NOT NULL DEFAULT 100");
  }

  // Add status column to people table (Active / Not Active)
  const pColumns = db.prepare("PRAGMA table_info(people)").all() as { name: string }[];
  if (!pColumns.some((c) => c.name === "status")) {
    db.exec("ALTER TABLE people ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'");
  }

  // Add billable_days column to personal_time_off table
  const ptoColumns = db.prepare("PRAGMA table_info(personal_time_off)").all() as { name: string }[];
  if (!ptoColumns.some((c) => c.name === "billable_days")) {
    db.exec("ALTER TABLE personal_time_off ADD COLUMN billable_days INTEGER");
  }

  // Add photo column to people table
  if (!pColumns.some((c) => c.name === "photo")) {
    db.exec("ALTER TABLE people ADD COLUMN photo TEXT");
  }

  // Add country column to people table
  if (!pColumns.some((c) => c.name === "country")) {
    db.exec("ALTER TABLE people ADD COLUMN country TEXT DEFAULT 'South Africa'");
    db.exec("UPDATE people SET country = 'South Africa' WHERE country IS NULL");
  }

  // Seed countries table with initial values
  const countryCount = (db.prepare("SELECT COUNT(*) as cnt FROM countries").get() as { cnt: number }).cnt;
  if (countryCount === 0) {
    const seedCountries = db.prepare("INSERT OR IGNORE INTO countries (name, code) VALUES (?, ?)");
    const seedAll = db.transaction(() => {
      seedCountries.run("South Africa", "ZA");
      seedCountries.run("United Kingdom", "GB");
      seedCountries.run("United States", "US");
      seedCountries.run("Brazil", "BR");
      seedCountries.run("Netherlands", "NL");
      seedCountries.run("Canada", "CA");
      seedCountries.run("France", "FR");
    });
    seedAll();
  }

  // Ensure additional countries are in the table (migration for existing DBs)
  db.prepare("INSERT OR IGNORE INTO countries (name, code) VALUES (?, ?)").run("France", "FR");
  db.prepare("INSERT OR IGNORE INTO countries (name, code) VALUES (?, ?)").run("Portugal", "PT");

  // Fix timesheet duplicates: the old UNIQUE(week_starts_on, user_name, task_number)
  // doesn't catch NULLs in task_number (Holiday, Training, etc.). Replace with a
  // unique index that uses COALESCE to handle NULLs properly.
  const hasOldUniqueIdx = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='sqlite_autoindex_timesheets_1'").get());
  const hasNewUniqueIdx = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_timesheets_unique_entry'").get());
  if (!hasNewUniqueIdx) {
    // First, remove duplicate rows — keep the one with the highest id for each group
    db.exec(`
      DELETE FROM timesheets WHERE id NOT IN (
        SELECT MAX(id) FROM timesheets
        GROUP BY week_starts_on, user_name, COALESCE(task_number, ''), COALESCE(category, '')
      )
    `);
    // Create the new unique index that handles NULLs
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheets_unique_entry
      ON timesheets(week_starts_on, user_name, COALESCE(task_number, ''), COALESCE(category, ''))
    `);
  }

  // Fix PTO duplicates: the old UNIQUE(kerb, start_date, end_date, type)
  // doesn't catch NULLs in kerb (National Holidays have no kerb).
  // Replace with a unique index using COALESCE + person_name + country.
  const hasPtoUniqueIdx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pto_unique_entry'").get();
  if (!hasPtoUniqueIdx) {
    // Remove duplicate PTO rows — keep the one with the highest id for each group
    db.exec(`
      DELETE FROM personal_time_off WHERE id NOT IN (
        SELECT MAX(id) FROM personal_time_off
        GROUP BY COALESCE(kerb, ''), COALESCE(person_name, ''), start_date, end_date, type, COALESCE(country, '')
      )
    `);
    // Create the new unique index that handles NULLs
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pto_unique_entry
      ON personal_time_off(COALESCE(kerb, ''), COALESCE(person_name, ''), start_date, end_date, type, COALESCE(country, ''))
    `);
  }

  // Add status column to projects table (Started / Completed)
  const projColumns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projColumns.some((c) => c.name === "status")) {
    db.exec("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'Started'");
    db.exec("UPDATE projects SET status = 'Started' WHERE status IS NULL");
  }

  // Add project_lead column to projects table (references people.person)
  if (!projColumns.some((c) => c.name === "project_lead")) {
    db.exec("ALTER TABLE projects ADD COLUMN project_lead TEXT");
  }

  // Migration: convert text birthdays ("March 28th") to "MM-DD" format
  const birthdayRows = db.prepare(
    `SELECT id, birthday FROM people
     WHERE birthday IS NOT NULL AND birthday != ''
     AND birthday NOT LIKE '__-__'`
  ).all() as { id: number; birthday: string }[];

  if (birthdayRows.length > 0) {
    const MONTH_MAP: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
    };

    const updateBirthday = db.prepare(
      "UPDATE people SET birthday = ? WHERE id = ?"
    );

    const migrateBirthdays = db.transaction(() => {
      for (const row of birthdayRows) {
        const text = row.birthday.trim();
        // Parse "Month Dayth" format (e.g. "March 28th")
        const match = text.match(/^(\w+)\s+(\d{1,2})/);
        if (match) {
          const monthNum = MONTH_MAP[match[1].toLowerCase()];
          const day = match[2].padStart(2, "0");
          if (monthNum && parseInt(day) >= 1 && parseInt(day) <= 31) {
            updateBirthday.run(`${monthNum}-${day}`, row.id);
          }
        } else {
          // Handle ISO date "YYYY-MM-DD"
          const isoMatch = text.match(/^\d{4}-(\d{2})-(\d{2})$/);
          if (isoMatch) {
            updateBirthday.run(`${isoMatch[1]}-${isoMatch[2]}`, row.id);
          }
        }
      }
    });

    migrateBirthdays();
  }

  // Auto-create project entries for any task_numbers in timesheets or planned_work
  // that don't yet have a corresponding row in the projects table
  db.exec(`
    INSERT OR IGNORE INTO projects (task_number, task_description)
    SELECT DISTINCT t.task_number, t.task_description FROM timesheets t
    WHERE t.category = 'Project' AND t.task_number IS NOT NULL AND t.task_number != ''
      AND t.task_number NOT IN (SELECT task_number FROM projects)
  `);
  db.exec(`
    INSERT OR IGNORE INTO projects (task_number, task_description)
    SELECT DISTINCT pw.task_number, pw.task_description FROM planned_work pw
    WHERE pw.task_number IS NOT NULL
      AND pw.task_number NOT IN (SELECT task_number FROM projects)
  `);

  // Run SQL file migrations from /migrations folder
  runMigrations(db);

  // Gracefully close on process exit to avoid stale locks
  process.on("SIGTERM", () => { try { db.close(); } catch { /* ignore */ } });
  process.on("SIGINT", () => { try { db.close(); } catch { /* ignore */ } });

  return db;
}

const db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}

export default db;

/**
 * Cleanup planned work entries that have dates in the past:
 * 1. DELETE entries where planned_end <= today (entirely in the past)
 * 2. UPDATE planned_start to today where planned_start < today (partially in the past)
 *
 * Called automatically before reading planned work data.
 */
export function cleanupPlannedWork(): void {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Delete entries that have completely passed
  db.prepare(
    `DELETE FROM planned_work WHERE planned_end <= ?`
  ).run(today);

  // Move planned_start forward to today for entries that have partially passed
  db.prepare(
    `UPDATE planned_work SET planned_start = ?, updated_at = datetime('now')
     WHERE planned_start < ?`
  ).run(today, today);
}

// Helper: get the applicable rate for a person on a given date
// Financial year runs 1 March - 28/29 Feb
export function getRate(personId: number, date: string): number {
  const row = db.prepare(`
    SELECT rate FROM people_rates
    WHERE person_id = ? AND ? >= fy_start AND ? <= fy_end
    ORDER BY fy_start DESC LIMIT 1
  `).get(personId, date, date) as { rate: number } | undefined;
  return row?.rate ?? 0;
}

// Helper: get the applicable rate for revenue calculations by joining on person name
export function getRateForUser(userName: string, date: string): number {
  const row = db.prepare(`
    SELECT pr.rate FROM people_rates pr
    JOIN people p ON pr.person_id = p.id
    WHERE p.person = ? AND ? >= pr.fy_start AND ? <= pr.fy_end
    ORDER BY pr.fy_start DESC LIMIT 1
  `).get(userName, date, date) as { rate: number } | undefined;
  return row?.rate ?? 0;
}
