-- ============================================
-- Migration 004: Create donations table
-- ============================================
-- Creates the donation_status ENUM type and the donations table with indexes.

-- ─── Custom ENUM Type ───
DO $$ BEGIN
  CREATE TYPE donation_status AS ENUM ('pending', 'reviewed', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Donations Table ───
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
