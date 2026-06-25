-- CatCare UTM Database Schema (PostgreSQL)
-- Run this in your PostgreSQL dashboard or PSQL console.

-- ─── Custom ENUM Types ───
CREATE TYPE user_role AS ENUM ('student', 'volunteer', 'manager', 'admin');
CREATE TYPE cat_health_status AS ENUM ('healthy', 'needs_attention', 'injured', 'unknown');
CREATE TYPE cat_ownership_tag AS ENUM ('stray', 'adopted', 'campus_managed', 'unknown');
CREATE TYPE emergency_type AS ENUM ('injury', 'sickness', 'missing', 'feeding_urgent', 'danger', 'other');
CREATE TYPE emergency_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE emergency_status AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE donation_status AS ENUM ('pending', 'reviewed', 'approved', 'rejected');

-- ─── Drop existing tables ───
DROP TABLE IF EXISTS emergency_reports CASCADE;
DROP TABLE IF EXISTS care_history CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS cats CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ─── Users ───
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users (email);

-- ─── Cats ───
CREATE TABLE cats (
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
CREATE INDEX idx_cats_created_at ON cats (created_at);

-- ─── Emergency Reports ───
CREATE TABLE emergency_reports (
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
CREATE INDEX idx_emergency_reports_status ON emergency_reports (status);
CREATE INDEX idx_emergency_reports_priority ON emergency_reports (priority);
CREATE INDEX idx_emergency_reports_created_at ON emergency_reports (created_at);
CREATE INDEX idx_emergency_reports_cat_id ON emergency_reports (cat_id);

-- ─── Donations ───
CREATE TABLE donations (
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
CREATE INDEX idx_donations_status ON donations (status);
CREATE INDEX idx_donations_donor_user_id ON donations (donor_user_id);
CREATE INDEX idx_donations_created_at ON donations (created_at);

-- ─── Care History ───
CREATE TYPE care_type AS ENUM ('feeding', 'medical', 'grooming', 'shelter', 'rescue', 'other');

CREATE TABLE care_history (
  id BIGSERIAL PRIMARY KEY,
  cat_id BIGINT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  care_type care_type NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR(120) NOT NULL,
  performed_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_care_history_cat_id ON care_history (cat_id);
CREATE INDEX idx_care_history_created_at ON care_history (created_at);
