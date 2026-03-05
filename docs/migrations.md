# Database Migrations

## Overview

Populus uses a lightweight SQL migration system. Numbered `.sql` files in the `migrations/` folder are applied automatically on app startup. Each migration runs once and is tracked in the `_migrations` table.

## How it works

1. On startup, the app checks the `migrations/` folder for `.sql` files
2. It compares them against the `_migrations` table to see which have already been applied
3. New migrations are applied in alphabetical order, inside a transaction
4. If a migration fails, the transaction rolls back and the app won't start

## Creating a migration

Add a new `.sql` file to the `migrations/` folder with a numbered prefix:

```
migrations/
  001_add_email_to_people.sql
  002_create_notifications_table.sql
  003_add_index_on_timesheets.sql
```

### Naming convention

```
<number>_<short_description>.sql
```

- Use zero-padded numbers (`001`, `002`, etc.) to ensure correct ordering
- Use snake_case for the description
- Keep descriptions short but descriptive

### Example: Adding a column

```sql
-- migrations/001_add_email_to_people.sql
ALTER TABLE people ADD COLUMN email TEXT
```

### Example: Creating a table

```sql
-- migrations/002_create_notifications_table.sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_person ON notifications(person_id)
```

## Rules

- Never rename or modify an already-applied migration — create a new one instead
- Never delete a migration file that has been deployed
- Each statement must be separated by a semicolon
- Test migrations locally before pushing

## Reseeding the database

To force a complete database reset with fresh seed data:

1. In Komodo, add `RESEED_DB=true` to the Stack environment variables
2. Redeploy the Stack
3. Remove `RESEED_DB=true` from the environment variables
4. Redeploy again (so future deploys don't keep reseeding)

This replaces the database with the version baked into the Docker image (`data/mit-people.db`).

## Checking applied migrations

From the Komodo terminal or via SQLite:

```sql
SELECT * FROM _migrations ORDER BY id;
```
