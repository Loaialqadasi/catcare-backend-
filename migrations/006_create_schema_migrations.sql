-- ============================================
-- Migration 006: Create schema_migrations table
-- ============================================
-- Creates the migration tracking table used by the migration system.
-- The migrate.ts runner bootstraps this table if it doesn't exist,
-- so this migration serves as a safety net / idempotent confirmation.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
