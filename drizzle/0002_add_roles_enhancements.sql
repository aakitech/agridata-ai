-- Migration: Add roles & permissions enhancements
-- Description: Renames admin role to org_admin, creates triage_enhancements table,
--              and adds enhancement tracking columns to reports.

-- Step 1: Rename 'admin' to 'org_admin' in user_role enum
ALTER TYPE user_role RENAME VALUE 'admin' TO 'org_admin';

-- Step 2: Create enhancement_type enum
CREATE TYPE enhancement_type AS ENUM ('quality', 'context', 'follow_up', 'internal');

-- Step 3: Add enhancement tracking columns to reports table
ALTER TABLE agridata_reports 
ADD COLUMN IF NOT EXISTS enhancement_count integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_enhancement_at timestamp with time zone;

-- Step 4: Create triage_enhancements table
CREATE TABLE IF NOT EXISTS agridata_triage_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES agridata_reports(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES agridata_app_users(id) ON DELETE CASCADE,
  enhancement_type enhancement_type NOT NULL,
  enhancement_text text NOT NULL,
  is_internal boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_triage_enhancements_report_id ON agridata_triage_enhancements(report_id);
CREATE INDEX IF NOT EXISTS idx_triage_enhancements_added_by ON agridata_triage_enhancements(added_by);
