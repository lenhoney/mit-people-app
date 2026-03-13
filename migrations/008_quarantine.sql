-- ============================================================================
-- 008: Login attempt tracking and account quarantine
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;
