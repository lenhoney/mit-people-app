-- Remove the overly-strict table-level UNIQUE(kerb, start_date, end_date, type) constraint.
-- The expression-based index idx_pto_unique_entry already provides proper uniqueness
-- with COALESCE handling for NULLs and includes person_name + country.

-- Step 1: Create new table without the table-level UNIQUE constraint
CREATE TABLE personal_time_off_new (
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
  billable_days INTEGER,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

-- Step 2: Copy all data
INSERT INTO personal_time_off_new
  SELECT * FROM personal_time_off;

-- Step 3: Drop old table
DROP TABLE personal_time_off;

-- Step 4: Rename new table
ALTER TABLE personal_time_off_new RENAME TO personal_time_off;

-- Step 5: Recreate all indexes
CREATE INDEX idx_pto_person ON personal_time_off(person_id);
CREATE INDEX idx_pto_dates ON personal_time_off(start_date, end_date);
CREATE INDEX idx_pto_type ON personal_time_off(type);
CREATE INDEX idx_pto_kerb ON personal_time_off(kerb);
CREATE UNIQUE INDEX idx_pto_unique_entry
  ON personal_time_off(COALESCE(kerb, ''), COALESCE(person_name, ''), start_date, end_date, type, COALESCE(country, ''));
