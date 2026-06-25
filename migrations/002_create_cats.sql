-- ============================================
-- Migration 002: Create cats table
-- ============================================
-- Creates cat_health_status and cat_ownership_tag ENUM types,
-- the cats table with indexes including health_status and trigram indexes.

-- ─── Custom ENUM Types ───
DO $$ BEGIN
  CREATE TYPE cat_health_status AS ENUM ('healthy', 'needs_attention', 'injured', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cat_ownership_tag AS ENUM ('stray', 'adopted', 'campus_managed', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Cats Table ───
CREATE TABLE IF NOT EXISTS cats (
  id BIGSERIAL PRIMARY KEY,
  nickname VARCHAR(100) NOT NULL,
  description TEXT NULL,
  photo_url VARCHAR(500) NULL,
  location_name VARCHAR(180) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  health_status cat_health_status NOT NULL DEFAULT 'unknown',
  ownership_tag cat_ownership_tag NOT NULL DEFAULT 'unknown',
  created_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cats_created_at ON cats (created_at);
-- MED-8 Fix: Index on health_status for filtered queries
CREATE INDEX IF NOT EXISTS idx_cats_health_status ON cats (health_status);
CREATE INDEX IF NOT EXISTS idx_cats_health_created ON cats (health_status, created_at DESC);

-- MED-09 Fix: Add trigram indexes for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cats_nickname_trgm ON cats USING GIN (nickname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cats_location_trgm ON cats USING GIN (location_name gin_trgm_ops);
