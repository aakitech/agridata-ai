-- Migration: Weather enrichment v2 humidity + timezone default
-- Description: Adds canonical relative humidity column, backfills from legacy humidity,
--              and updates default weather timezone for new rows.

ALTER TABLE agridata_report_weather
  ADD COLUMN IF NOT EXISTS relative_humidity_pct numeric(6,2);

UPDATE agridata_report_weather
SET relative_humidity_pct = humidity_mean_pct
WHERE relative_humidity_pct IS NULL
  AND humidity_mean_pct IS NOT NULL;

ALTER TABLE agridata_report_weather
  ALTER COLUMN timezone SET DEFAULT 'Africa/Johannesburg';
