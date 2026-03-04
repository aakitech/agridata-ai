-- Migration: Add report weather enrichment table
-- Description: Creates weather enrichment enums and a report_weather table
--              for async enrichment, retries, quality flags, and auditability.

DO $$
BEGIN
  CREATE TYPE weather_enrichment_status AS ENUM ('PENDING', 'OK', 'FAILED', 'NEEDS_REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE weather_quality_flag AS ENUM ('UNKNOWN', 'PLAUSIBLE', 'SUSPECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS agridata_report_weather (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES agridata_reports(id) ON DELETE CASCADE,
  org_id uuid REFERENCES agridata_organizations(id) ON DELETE CASCADE,
  lat numeric(9,6),
  lon numeric(9,6),
  observed_at timestamptz NOT NULL,
  observed_local_date date NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Harare',
  grid_key text,
  source text,
  status weather_enrichment_status NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error_at timestamptz,
  error_code text,
  fetched_at timestamptz,
  rain_day_mm numeric(10,3),
  rain_7d_mm numeric(10,3),
  temp_min_c numeric(6,2),
  temp_max_c numeric(6,2),
  temp_mean_c numeric(6,2),
  humidity_mean_pct numeric(6,2),
  reviewed_by uuid REFERENCES agridata_app_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  quality_flag weather_quality_flag NOT NULL DEFAULT 'UNKNOWN',
  provider_version text,
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS report_weather_status_next_retry_idx
  ON agridata_report_weather(status, next_retry_at);

CREATE INDEX IF NOT EXISTS report_weather_org_observed_at_idx
  ON agridata_report_weather(org_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS report_weather_grid_observed_date_idx
  ON agridata_report_weather(grid_key, observed_local_date);

CREATE INDEX IF NOT EXISTS report_weather_quality_status_idx
  ON agridata_report_weather(quality_flag, status);
