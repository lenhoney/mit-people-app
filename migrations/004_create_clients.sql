CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_name TEXT UNIQUE NOT NULL,
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  logo TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_unit_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_unit_id INTEGER NOT NULL REFERENCES business_units(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  UNIQUE(business_unit_id, client_id)
);

ALTER TABLE projects ADD COLUMN client_id INTEGER REFERENCES clients(id);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

INSERT INTO clients (name, short_name, contact_person, contact_email)
VALUES ('Massachusetts Institute of Technology', 'MIT', 'Olu Brown', 'obrown@mit.edu');

INSERT INTO business_unit_clients (business_unit_id, client_id)
SELECT bu.id, c.id FROM business_units bu, clients c
WHERE bu.short_name = 'GS' AND c.short_name = 'MIT';

UPDATE projects SET client_id = (SELECT id FROM clients WHERE short_name = 'MIT')
