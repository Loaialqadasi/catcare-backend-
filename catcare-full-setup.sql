-- ============================================
-- CatCare UTM — Full Database Setup (PostgreSQL)
-- ============================================
-- Run this in the Supabase SQL Editor (or any PostgreSQL client):
--   1. Go to your Supabase project dashboard
--   2. Click "SQL Editor" in the left sidebar
--   3. Paste this entire script
--   4. Click "Run"
-- Alternatively, you can run it via psql:
--   psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres" -f catcare-full-setup.sql
-- ============================================
-- WARNING: This script creates tables and inserts seed data.
-- For a destructive reset, use reset-dev.sql instead.
-- ============================================

-- ─── Custom ENUM Types ───
CREATE TYPE user_role AS ENUM ('student', 'volunteer', 'manager', 'admin');
CREATE TYPE cat_health_status AS ENUM ('healthy', 'needs_attention', 'injured', 'unknown');
CREATE TYPE cat_ownership_tag AS ENUM ('stray', 'adopted', 'campus_managed', 'unknown');
CREATE TYPE emergency_type AS ENUM ('injury', 'sickness', 'missing', 'feeding_urgent', 'danger', 'other');
CREATE TYPE emergency_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE emergency_status AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE donation_status AS ENUM ('pending', 'reviewed', 'approved', 'rejected');

-- ─── Create Tables (idempotent — uses IF NOT EXISTS) ───
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS cats (
  id BIGSERIAL PRIMARY KEY,
  nickname VARCHAR(100) NOT NULL,
  description TEXT NULL,
  photo_url VARCHAR(500) NULL,
  location_name VARCHAR(180) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  health_status cat_health_status NOT NULL DEFAULT 'unknown',
  ownership_tag cat_ownership_tag NOT NULL DEFAULT 'unknown',
  created_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cats_created_at ON cats (created_at);
-- MED-8 Fix: Index on health_status for filtered queries
CREATE INDEX IF NOT EXISTS idx_cats_health_status ON cats (health_status);
CREATE INDEX IF NOT EXISTS idx_cats_health_created ON cats (health_status, created_at DESC);

-- MED-09 Fix: Add trigram indexes for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cats_nickname_trgm ON cats USING GIN (nickname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cats_location_trgm ON cats USING GIN (location_name gin_trgm_ops);

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

CREATE TABLE IF NOT EXISTS donations (
  id BIGSERIAL PRIMARY KEY,
  donor_name VARCHAR(120) NOT NULL,
  donor_email VARCHAR(160) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  receipt_url VARCHAR(500) NULL,
  note TEXT NULL,
  status donation_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  donor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations (status);
CREATE INDEX IF NOT EXISTS idx_donations_donor_user_id ON donations (donor_user_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations (created_at);

-- ─── Care History Table ───
DO $$ BEGIN
  CREATE TYPE care_type AS ENUM ('feeding', 'medical', 'grooming', 'shelter', 'rescue', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_care_history_cat_created ON care_history (cat_id, created_at DESC);

-- ─── Audit Log Table ───
-- Captures security-relevant actions for compliance and forensics.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(160) NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NULL,
  target_id VARCHAR(40) NULL,
  metadata JSONB NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor      ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target     ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- ─── updated_at maintenance trigger ───
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
