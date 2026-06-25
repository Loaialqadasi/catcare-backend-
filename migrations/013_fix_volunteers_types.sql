-- ============================================
-- Migration 013: Fix volunteers table types
-- ============================================
-- Convert volunteers.id from SERIAL to BIGSERIAL and user_id from INTEGER to BIGINT
-- for consistency with other tables. Also convert status from VARCHAR to proper ENUM.
--
-- IMPORTANT: PostgreSQL cannot auto-cast the existing DEFAULT when changing
-- a column type from VARCHAR to ENUM. We must drop the default first,
-- change the type, then re-add the default with the new type.

-- ─── Custom ENUM Type ───
DO $$ BEGIN
  CREATE TYPE volunteer_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Alter user_id column from INTEGER to BIGINT
ALTER TABLE volunteers ALTER COLUMN user_id TYPE BIGINT USING user_id::bigint;

-- Alter status column from VARCHAR to volunteer_status ENUM
-- Step 1: Drop the existing DEFAULT (which is VARCHAR-typed)
ALTER TABLE volunteers ALTER COLUMN status DROP DEFAULT;

-- Step 2: Change the column type
ALTER TABLE volunteers ALTER COLUMN status TYPE volunteer_status USING status::volunteer_status;

-- Step 3: Re-add the DEFAULT with the proper ENUM type
ALTER TABLE volunteers ALTER COLUMN status SET DEFAULT 'pending'::volunteer_status;

-- Note: Changing SERIAL to BIGSERIAL requires altering the sequence type
ALTER SEQUENCE volunteers_id_seq AS bigint;
ALTER TABLE volunteers ALTER COLUMN id TYPE BIGINT USING id::bigint;
