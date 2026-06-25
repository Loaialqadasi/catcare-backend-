-- ============================================
-- CatCare UTM — DEVELOPMENT ONLY: Reset Database
-- ============================================
-- ⚠️  WARNING: This will DELETE ALL DATA in the database!
-- ⚠️  NEVER run this against a production database!
-- ============================================

DROP TABLE IF EXISTS emergency_reports CASCADE;
DROP TABLE IF EXISTS care_history CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS cats CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS cat_health_status CASCADE;
DROP TYPE IF EXISTS cat_ownership_tag CASCADE;
DROP TYPE IF EXISTS emergency_type CASCADE;
DROP TYPE IF EXISTS emergency_priority CASCADE;
DROP TYPE IF EXISTS emergency_status CASCADE;
DROP TYPE IF EXISTS donation_status CASCADE;
DROP TYPE IF EXISTS care_type CASCADE;
