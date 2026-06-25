-- ============================================
-- Migration 014: Add missing indexes and constraints
-- ============================================
-- Adds indexes that were missing for frequently queried columns.

-- Index on donations status + created_at for admin dashboard filtered queries
CREATE INDEX IF NOT EXISTS idx_donations_status_created ON donations (status, created_at DESC);

-- Index on emergency_reports priority for priority feed sorting
CREATE INDEX IF NOT EXISTS idx_emergency_reports_priority_status ON emergency_reports (priority, status);

-- Index on users role for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Index on cats created_by_user_id for user's cats queries
CREATE INDEX IF NOT EXISTS idx_cats_created_by ON cats (created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- Index on emergency_reports reported_by_user_id
CREATE INDEX IF NOT EXISTS idx_emergency_reports_reported_by ON emergency_reports (reported_by_user_id) WHERE reported_by_user_id IS NOT NULL;
