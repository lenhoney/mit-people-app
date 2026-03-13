/**
 * One-time data migration script: SQLite → PostgreSQL
 *
 * Usage:
 *   1. Ensure PostgreSQL is running and DATABASE_URL is set
 *   2. Ensure the app has started at least once (migrations applied to PG)
 *   3. Run: npx tsx scripts/migrate-data.ts
 *
 * This script reads data from the local SQLite database (data/mit-people.db)
 * and inserts it into the PostgreSQL database specified by DATABASE_URL.
 */

import Database from "better-sqlite3";
import { Pool } from "pg";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "mit-people.db");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sqlite = new Database(DB_PATH, { readonly: true });
const pool = new Pool({ connectionString: DATABASE_URL });

interface TableConfig {
  name: string;
  columns: string[];
}

const TABLES: TableConfig[] = [
  {
    name: "countries",
    columns: ["id", "name", "code", "created_at"],
  },
  {
    name: "people",
    columns: [
      "id", "person", "sow", "role", "kerb",
      "managed_services", "architecture", "app_support", "computing",
      "phone", "work_anniversary", "birthday", "manager_name", "business_unit",
      "status", "photo", "country", "created_at", "updated_at",
    ],
  },
  {
    name: "people_rates",
    columns: ["id", "person_id", "fy_start", "fy_end", "fy_label", "rate", "created_at"],
  },
  {
    name: "business_units",
    columns: [
      "id", "short_name", "registered_name", "signatory_for_icm",
      "manager_1", "manager_2",
      "registered_street_address", "registered_city", "registered_zipcode", "registered_country",
      "icm_signatory_name", "icm_signatory_title", "icm_contractual_address",
      "icm_signatory_phone", "icm_signatory_email",
      "icm_billing_name", "icm_billing_title", "icm_billing_address",
      "icm_billing_phone", "icm_billing_email",
      "created_at", "updated_at",
    ],
  },
  {
    name: "clients",
    columns: ["id", "name", "short_name", "contact_person", "contact_email", "logo", "created_at", "updated_at"],
  },
  {
    name: "business_unit_clients",
    columns: ["id", "business_unit_id", "client_id"],
  },
  {
    name: "projects",
    columns: [
      "id", "task_number", "task_description", "group_label", "budget",
      "status", "project_lead", "client_id", "created_at", "updated_at",
    ],
  },
  {
    name: "timesheets",
    columns: [
      "id", "week_starts_on", "category", "user_name", "task_description",
      "task_number", "state",
      "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "total",
      "created_at", "updated_at",
    ],
  },
  {
    name: "planned_work",
    columns: [
      "id", "person_id", "task_number", "task_description",
      "planned_start", "planned_end", "allocation_pct",
      "created_at", "updated_at",
    ],
  },
  {
    name: "personal_time_off",
    columns: [
      "id", "person_id", "person_name", "kerb",
      "start_date", "end_date", "type", "leave_status", "country", "message",
      "business_days", "billable_days",
      "created_at", "updated_at",
    ],
  },
  {
    name: "audit_trail",
    columns: ["id", "user_name", "user_email", "action", "entity_type", "entity_id", "details", "created_at"],
  },
];

async function migrateTable(table: TableConfig): Promise<number> {
  const rows = sqlite.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all() as Record<string, unknown>[];

  if (rows.length === 0) {
    console.log(`  ${table.name}: 0 rows (empty)`);
    return 0;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing data
    await client.query(`DELETE FROM ${table.name}`);

    // Batch insert in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk.map((_, rowIdx) => {
        const base = rowIdx * table.columns.length;
        return `(${table.columns.map((_, colIdx) => `$${base + colIdx + 1}`).join(", ")})`;
      }).join(", ");

      const values = chunk.flatMap((row) =>
        table.columns.map((col) => row[col] ?? null)
      );

      await client.query(
        `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES ${placeholders}`,
        values
      );
    }

    // Reset the serial sequence to max(id) + 1
    if (table.columns.includes("id")) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), COALESCE((SELECT MAX(id) FROM ${table.name}), 0))`
      );
    }

    await client.query("COMMIT");
    console.log(`  ${table.name}: ${rows.length} rows migrated`);
    return rows.length;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`  ${table.name}: FAILED -`, err);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log("=== SQLite → PostgreSQL Data Migration ===");
  console.log(`SQLite: ${DB_PATH}`);
  console.log(`PostgreSQL: ${DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);
  console.log("");

  let totalRows = 0;

  for (const table of TABLES) {
    totalRows += await migrateTable(table);
  }

  console.log("");
  console.log(`Migration complete. ${totalRows} total rows migrated across ${TABLES.length} tables.`);

  sqlite.close();
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
