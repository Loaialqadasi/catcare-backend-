-- ============================================
-- Migration 012: Add 'manager' role to user_role enum
-- ============================================
-- Adds the 'manager' role so that managers can review donations
-- without having full admin access.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager' BEFORE 'admin';
