-- ============================================
-- Migration 016: Restore 'manager' role to user_role enum
-- ============================================
-- Reverts migration 015. The 'manager' role sits between volunteer
-- and admin: managers can review volunteer applications, manage cats
-- and emergencies, but cannot manage users (create/delete users,
-- change roles, reset passwords — those remain admin-only).
--
-- PostgreSQL allows ADDVALUE to an existing enum without recreating
-- the type, so this migration is safe and non-destructive.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager' AFTER 'volunteer';

-- Backfill: any user previously downgraded to 'volunteer' by migration 015
-- whose email is in the legacy manager allowlist gets restored to 'manager'.
-- (Replace / extend the allowlist below to match your real managers.)
UPDATE users
SET role = 'manager', updated_at = NOW()
WHERE email IN ('manager@utm.my', 'manager@graduate.utm.my')
  AND role = 'volunteer';
