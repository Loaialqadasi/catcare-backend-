-- ============================================
-- Migration 009: Create password_resets table
-- ============================================
-- Stores hashed password reset tokens for the password reset flow.
-- Tokens are SHA-256 hashed for security (the raw token is only sent via email).
-- This replaces the previous stateless JWT approach with a server-side approach
-- that supports token invalidation and usage tracking.

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast token lookups during password reset
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token_hash);

-- Index for finding all resets for a given user (e.g., to invalidate all on password change)
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);
