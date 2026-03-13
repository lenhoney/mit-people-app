-- ============================================================================
-- 007: Role-Based Access Control (RBAC)
-- ============================================================================

-- Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRUD permissions per menu item per role
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  menu_item TEXT NOT NULL,
  can_create BOOLEAN DEFAULT FALSE,
  can_read BOOLEAN DEFAULT FALSE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  UNIQUE(role_id, menu_item)
);

-- Many-to-many: user <-> role
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_id ON user_role_assignments(role_id);

-- ============================================================================
-- Seed: Super User role with full CRUD on all menu items
-- ============================================================================

INSERT INTO user_roles (name, description, is_system)
VALUES ('Super User', 'Full access to all features', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Insert full CRUD permissions for Super User on all 13 menu items
-- Using subquery to get super_role_id inline (avoids DO $$ blocks)
INSERT INTO role_permissions (role_id, menu_item, can_create, can_read, can_update, can_delete)
SELECT ur.id, item.name, TRUE, TRUE, TRUE, TRUE
FROM user_roles ur
CROSS JOIN (VALUES
  ('dashboard'), ('people'), ('business-units'), ('clients'), ('projects'),
  ('timesheets'), ('reports'), ('gantt'), ('planned-work'), ('time-off'),
  ('audit-trail'), ('users'), ('user-roles')
) AS item(name)
WHERE ur.name = 'Super User'
ON CONFLICT (role_id, menu_item) DO NOTHING;

-- ============================================================================
-- Seed: Assign admin user to Super User role & mark as protected
-- ============================================================================

INSERT INTO user_role_assignments (user_id, role_id)
SELECT u.id, ur.id
FROM users u
CROSS JOIN user_roles ur
WHERE u.email = 'lennox.honeyborne@epiuse.com'
  AND ur.name = 'Super User'
ON CONFLICT (user_id, role_id) DO NOTHING;

UPDATE users SET is_protected = TRUE
WHERE email = 'lennox.honeyborne@epiuse.com';
