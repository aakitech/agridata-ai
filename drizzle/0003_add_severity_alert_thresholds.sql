-- Migration: Add severity system and org alert thresholds
-- Description: Adds severity enum, severity/observedCount columns to reports,
--              and creates org_alert_thresholds table for per-pest alert configuration.

-- Step 1: Create severity enum
CREATE TYPE IF NOT EXISTS severity AS ENUM ('NORMAL', 'WARNING', 'HIGH');

-- Step 2: Add severity and observedCount columns to reports table
ALTER TABLE agridata_reports 
ADD COLUMN IF NOT EXISTS severity severity,
ADD COLUMN IF NOT EXISTS observed_count integer;

-- Step 3: Create org_alert_thresholds table
CREATE TABLE IF NOT EXISTS agridata_org_alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES agridata_organizations(id) ON DELETE CASCADE,
  pest_key text NOT NULL,
  normal_max integer NOT NULL,
  warning_max integer NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_alert_thresholds_org_id ON agridata_org_alert_thresholds(org_id);
CREATE INDEX IF NOT EXISTS idx_org_alert_thresholds_pest_key ON agridata_org_alert_thresholds(pest_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_alert_thresholds_org_pest_unique ON agridata_org_alert_thresholds(org_id, pest_key);



