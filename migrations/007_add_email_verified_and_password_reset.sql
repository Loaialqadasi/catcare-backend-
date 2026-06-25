-- ============================================
-- Migration 007: Add email_verified and password_reset fields
-- ============================================
-- Adds email_verified column for email verification flow
-- and password_reset_token/password_reset_expires for password reset flow

-- ─── Email Verification ───
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Password Reset (stateless JWT approach — no columns needed) ───
-- We use stateless JWTs for password reset tokens, so no extra columns needed.
-- If we later want to invalidate tokens server-side, we can add:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) NULL;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ NULL;

-- Index for querying unverified users
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users (email_verified) WHERE email_verified = FALSE;
