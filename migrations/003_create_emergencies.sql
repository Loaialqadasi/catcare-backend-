-- ============================================
-- Migration 003: Create emergency_reports table
-- ============================================
-- Creates emergency_type, emergency_priority, and emergency_status ENUM types,
-- the emergency_reports table with indexes.

-- ─── Custom ENUM Types ───
DO $$ BEGIN
  CREATE TYPE emergency_type AS ENUM ('injury', 'sickness', 'missing', 'feeding_urgent', 'danger', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE emergency_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE emergency_status AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Emergency Reports Table ───
CREATE TABLE IF NOT EXISTS emergency_reports (
  id BIGSERIAL PRIMARY KEY,
  cat_id BIGINT NULL REFERENCES cats(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  emergency_type emergency_type NOT NULL,
  priority emergency_priority NOT NULL DEFAULT 'high',
  status emergency_status NOT NULL DEFAULT 'open',
  location_name VARCHAR(180) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  reported_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_emergency_reports_status ON emergency_reports (status);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_priority ON emergency_reports (priority);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_created_at ON emergency_reports (created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_cat_id ON emergency_reports (cat_id);
