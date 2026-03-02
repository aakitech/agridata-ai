-- Migration: Add provisional weather flag
-- Description: Marks same-day weather enrichments as provisional and enables re-finalization jobs.

ALTER TABLE agridata_report_weather
ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS report_weather_provisional_status_idx
  ON agridata_report_weather(is_provisional, status);

