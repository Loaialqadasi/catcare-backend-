-- ============================================
-- Migration 005: Create care_history table
-- ============================================
-- Creates the care_type ENUM type and the care_history table with indexes.

-- ─── Custom ENUM Type ───
DO $$ BEGIN
  CREATE TYPE care_type AS ENUM ('feeding', 'medical', 'grooming', 'shelter', 'rescue', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Care History Table ───
CREATE TABLE IF NOT EXISTS care_history (
  id BIGSERIAL PRIMARY KEY,
  cat_id BIGINT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  care_type care_type NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR(120) NOT NULL,
  performed_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_history_cat_id ON care_history (cat_id);
CREATE INDEX IF NOT EXISTS idx_care_history_created_at ON care_history (created_at);
