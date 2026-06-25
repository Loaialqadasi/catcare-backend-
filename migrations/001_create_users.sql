-- ============================================
-- Migration 001: Create users table
-- ============================================
-- Creates the user_role ENUM type and the users table with email index.

-- ─── Custom ENUM Type ───
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'volunteer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Users Table ───
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
