/**
 * Local development: start an embedded PostgreSQL server.
 *
 * Usage:
 *   npx tsx scripts/start-db.ts          # start and keep running
 *   npx tsx scripts/start-db.ts --init   # initialise + start (first time)
 *
 * The database files are persisted in data/pg so data survives restarts.
 * Connection string: postgresql://populus:populus@localhost:5432/populus
 */

import EmbeddedPostgres from "embedded-postgres";
import path from "path";

const DB_DIR = path.join(process.cwd(), "data", "pg");

const pg = new EmbeddedPostgres({
  databaseDir: DB_DIR,
  port: 5432,
  user: "populus",
  password: "populus",
  persistent: true,
  onLog: (msg: string) => {
    if (msg.trim()) console.log(`[pg] ${msg.trim()}`);
  },
  onError: (msg: string) => {
    if (msg.trim()) console.error(`[pg:err] ${msg.trim()}`);
  },
});

async function main() {
  const isInit = process.argv.includes("--init");

  if (isInit) {
    console.log("Initialising PostgreSQL cluster...");
    await pg.initialise();
    console.log("Starting PostgreSQL...");
    await pg.start();
    console.log("Creating 'populus' database...");
    await pg.createDatabase("populus");
    console.log("Done. PostgreSQL is running on port 5432.");
  } else {
    console.log("Starting PostgreSQL...");
    await pg.start();
    console.log("PostgreSQL is running on port 5432.");
  }

  console.log("Press Ctrl+C to stop.\n");

  // Keep the process alive and handle graceful shutdown
  const shutdown = async () => {
    console.log("\nStopping PostgreSQL...");
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Failed to start PostgreSQL:", err);
  process.exit(1);
});
