-- ============================================
-- Migration 015: Remove 'manager' role from user_role enum
-- ============================================
-- The manager role is no longer used. All former managers should be
-- converted to either 'admin' (if they need admin access) or 'volunteer'.
--
-- IMPORTANT: PostgreSQL does not support removing a value from an enum
-- directly. We must recreate the type. This is done in a transaction
-- so it can be rolled back if anything fails.

-- First, update any existing manager users to volunteer role
UPDATE users SET role = 'volunteer' WHERE role = 'manager';

-- Then recreate the enum type without 'manager'
DO $$
BEGIN
  -- Drop the old type and recreate without 'manager'
  -- We need to handle the column dependency
  ALTER TABLE users ALTER COLUMN role TYPE TEXT;
  DROP TYPE IF EXISTS user_role;
  CREATE TYPE user_role AS ENUM ('student', 'volunteer', 'admin');
  ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Manager role removal skipped: %', SQLERRM;
END $$;
