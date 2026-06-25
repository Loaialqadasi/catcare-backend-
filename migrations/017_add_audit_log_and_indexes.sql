-- ============================================
-- Migration 017: Add audit log table and additional performance indexes
-- ============================================
-- Audit log captures security-relevant actions (auth, role changes,
-- deletes, password resets) for compliance and incident response.
-- Performance indexes target the most common query patterns observed
-- in production (filtering by status, sorting by created_at, joins
-- on foreign keys).
-- ============================================

-- ─── Audit log ───
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(160) NULL,        -- denormalised for forensics after user deletion
  action VARCHAR(80) NOT NULL,          -- e.g. 'user.role.update', 'cat.delete', 'auth.login'
  target_type VARCHAR(40) NULL,         -- e.g. 'user', 'cat', 'donation'
  target_id VARCHAR(40) NULL,           -- string to support BIGINT + UUID targets
  metadata JSONB NULL,                  -- arbitrary key/value context
  ip_address INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor       ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target      ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log (created_at DESC);

-- ─── Performance indexes (high-frequency query paths) ───
-- Donations: dashboard summary counts grouped by status
CREATE INDEX IF NOT EXISTS idx_donations_status_created
  ON donations (status, created_at DESC);

-- Emergencies: priority feed sorted by priority + created_at
CREATE INDEX IF NOT EXISTS idx_emergencies_priority_created
  ON emergency_reports (priority, created_at DESC)
  WHERE deleted_at IS NULL;

-- Emergencies: filter by status (open/in_progress/resolved/cancelled)
CREATE INDEX IF NOT EXISTS idx_emergencies_status_created
  ON emergency_reports (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Care history: list by cat ordered by recency
CREATE INDEX IF NOT EXISTS idx_care_history_cat_created
  ON care_history (cat_id, created_at DESC);

-- Volunteers: list by status with pagination
CREATE INDEX IF NOT EXISTS idx_volunteers_status_created
  ON volunteers (status, created_at DESC);

-- Refresh tokens: lookup by user + expiry (rotation flow)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expires
  ON refresh_tokens (user_id, expires_at);

-- Users: filter by role (admin dashboard "users by role" widget)
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

-- ─── set_updated_at() function ───
-- MUST be created BEFORE the DO $$ block below uses it.
-- (Older databases that were bootstrapped from catcare-full-setup.sql already
--  have this function, but we declare it here too so this migration is
--  self-sufficient and idempotent — CREATE OR REPLACE is a no-op if it exists.)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Updated_at trigger ───
-- Auto-maintain updated_at on all tables that have the column.
-- Keeps updated_at accurate even when rows are touched by raw SQL.
-- Note: we skip re-creating triggers on tables that don't need them —
-- information_schema query limits the loop to tables that actually
-- have an updated_at column.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I; CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t
    );
  END LOOP;
END $$;
