-- Migration: Add severity source tracking
-- Description: Adds severity_source enum and column to reports table to track
--              whether severity was computed from org config or default fallback.
--
-- Note: PostgreSQL doesn't support IF NOT EXISTS for CREATE TYPE, so this migration
--       should be run via the script which handles the error gracefully.

-- Step 1: Create severity_source enum
CREATE TYPE severity_source AS ENUM ('ORG_CONFIG', 'DEFAULT_FALLBACK');

-- Step 2: Add severity_source column to reports table (nullable for backward compatibility)
ALTER TABLE agridata_reports 
ADD COLUMN IF NOT EXISTS severity_source severity_source;

