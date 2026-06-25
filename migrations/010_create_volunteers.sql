-- ============================================
-- Migration 010: Create volunteers table
-- ============================================
-- Uses BIGSERIAL/BIGINT for consistency with other tables,
-- and a proper PostgreSQL ENUM for status instead of VARCHAR.

-- ─── Custom ENUM Type ───
DO $$ BEGIN
  CREATE TYPE volunteer_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Volunteers Table ───
CREATE TABLE IF NOT EXISTS volunteers (
  id BIGSERIAL PRIMARY KEY,
  student_name VARCHAR(200) NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 16 AND age <= 100),
  faculty VARCHAR(200) NOT NULL,
  interests TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status volunteer_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteers_user_id ON volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status);
CREATE INDEX IF NOT EXISTS idx_volunteers_created_at ON volunteers(created_at);
