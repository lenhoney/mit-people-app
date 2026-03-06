CREATE TABLE IF NOT EXISTS business_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed existing business unit short names so the People dropdown continues to work.
-- All required fields use placeholder values that should be updated via the UI.
INSERT OR IGNORE INTO business_units (short_name, registered_name, signatory_for_icm, manager_1, registered_street_address, registered_city, registered_zipcode, registered_country, icm_signatory_name, icm_signatory_title, icm_contractual_address, icm_signatory_phone, icm_signatory_email, icm_billing_name, icm_billing_title, icm_billing_address, icm_billing_phone, icm_billing_email)
VALUES
  ('GEL', 'GEL', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'),
  ('EUAM', 'EUAM', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'),
  ('EUAF', 'EUAF', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'),
  ('EUBR', 'EUBR', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'),
  ('GS', 'GS', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'),
  ('Advance', 'Advance', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'),
  ('Labs', 'Labs', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-');
