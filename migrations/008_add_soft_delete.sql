-- ============================================
-- Migration 008: Add soft delete columns
-- ============================================
-- Adds deleted_at columns to cats and emergency_reports for soft delete support.

-- ─── Cats ───
ALTER TABLE cats ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- ─── Emergency Reports ───
ALTER TABLE emergency_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- ─── Indexes for soft-delete-aware queries ───
CREATE INDEX IF NOT EXISTS idx_cats_deleted_at ON cats (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emergency_reports_deleted_at ON emergency_reports (deleted_at) WHERE deleted_at IS NULL;
