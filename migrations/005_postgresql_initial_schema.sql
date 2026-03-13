-- Complete PostgreSQL schema for Populus
-- Consolidates all inline DDL from db.ts + migrations 001-004

-- ── Core tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
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
  status TEXT NOT NULL DEFAULT 'Active',
  photo TEXT,
  country TEXT DEFAULT 'South Africa',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people_rates (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL,
  fy_start TEXT NOT NULL,
  fy_end TEXT NOT NULL,
  fy_label TEXT NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, fy_label),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timesheets (
  id SERIAL PRIMARY KEY,
  week_starts_on TEXT NOT NULL,
  category TEXT,
  user_name TEXT NOT NULL,
  task_description TEXT,
  task_number TEXT,
  state TEXT,
  sunday DOUBLE PRECISION DEFAULT 0,
  monday DOUBLE PRECISION DEFAULT 0,
  tuesday DOUBLE PRECISION DEFAULT 0,
  wednesday DOUBLE PRECISION DEFAULT 0,
  thursday DOUBLE PRECISION DEFAULT 0,
  friday DOUBLE PRECISION DEFAULT 0,
  saturday DOUBLE PRECISION DEFAULT 0,
  total DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planned_work (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL,
  task_number TEXT NOT NULL,
  task_description TEXT,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  allocation_pct INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, task_number),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  task_number TEXT UNIQUE NOT NULL,
  task_description TEXT,
  group_label TEXT,
  budget DOUBLE PRECISION,
  status TEXT DEFAULT 'Started',
  project_lead TEXT,
  client_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_time_off (
  id SERIAL PRIMARY KEY,
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
  billable_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit trail (from migration 001) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_trail (
  id SERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Business units (from migration 003) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_units (
  id SERIAL PRIMARY KEY,
  short_name TEXT UNIQUE NOT NULL,
  registered_name TEXT NOT NULL,
  signatory_for_icm TEXT NOT NULL,
  manager_1 TEXT NOT NULL,
  manager_2 TEXT,
  registered_street_address TEXT NOT NULL,
  registered_city TEXT NOT NULL,
  registered_zipcode TEXT NOT NULL,
  registered_country TEXT NOT NULL,
  icm_signatory_name TEXT NOT NULL,
  icm_signatory_title TEXT NOT NULL,
  icm_contractual_address TEXT NOT NULL,
  icm_signatory_phone TEXT NOT NULL,
  icm_signatory_email TEXT NOT NULL,
  icm_billing_name TEXT NOT NULL,
  icm_billing_title TEXT NOT NULL,
  icm_billing_address TEXT NOT NULL,
  icm_billing_phone TEXT NOT NULL,
  icm_billing_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clients (from migration 004) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT UNIQUE NOT NULL,
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  logo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_unit_clients (
  id SERIAL PRIMARY KEY,
  business_unit_id INTEGER NOT NULL REFERENCES business_units(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  UNIQUE(business_unit_id, client_id)
);

-- ── Foreign keys that depend on other tables ───────────────────────────────

ALTER TABLE projects ADD CONSTRAINT fk_projects_client
  FOREIGN KEY (client_id) REFERENCES clients(id);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_task_number ON projects(task_number);
CREATE INDEX IF NOT EXISTS idx_projects_group_label ON projects(group_label);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_user ON timesheets(user_name);
CREATE INDEX IF NOT EXISTS idx_timesheets_week ON timesheets(week_starts_on);
CREATE INDEX IF NOT EXISTS idx_timesheets_category ON timesheets(category);
CREATE INDEX IF NOT EXISTS idx_timesheets_task ON timesheets(task_number);

CREATE INDEX IF NOT EXISTS idx_people_person ON people(person);
CREATE INDEX IF NOT EXISTS idx_people_rates_person ON people_rates(person_id);
CREATE INDEX IF NOT EXISTS idx_people_rates_fy ON people_rates(fy_start, fy_end);

CREATE INDEX IF NOT EXISTS idx_planned_work_person ON planned_work(person_id);
CREATE INDEX IF NOT EXISTS idx_planned_work_task ON planned_work(task_number);

CREATE INDEX IF NOT EXISTS idx_pto_person ON personal_time_off(person_id);
CREATE INDEX IF NOT EXISTS idx_pto_dates ON personal_time_off(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_pto_type ON personal_time_off(type);
CREATE INDEX IF NOT EXISTS idx_pto_kerb ON personal_time_off(kerb);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_name);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);

-- ── Expression-based unique indexes for NULL handling ──────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheets_unique_entry
  ON timesheets(week_starts_on, user_name, COALESCE(task_number, ''), COALESCE(category, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_pto_unique_entry
  ON personal_time_off(COALESCE(kerb, ''), COALESCE(person_name, ''), start_date, end_date, type, COALESCE(country, ''));

-- ── Seed data ──────────────────────────────────────────────────────────────

INSERT INTO countries (name, code) VALUES
  ('South Africa', 'ZA'),
  ('United Kingdom', 'GB'),
  ('United States', 'US'),
  ('Brazil', 'BR'),
  ('Netherlands', 'NL'),
  ('Canada', 'CA'),
  ('France', 'FR'),
  ('Portugal', 'PT')
ON CONFLICT (name) DO NOTHING
