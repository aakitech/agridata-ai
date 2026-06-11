DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'severity_source'
  ) THEN
    CREATE TYPE "public"."severity_source" AS ENUM (
      'ORG_CONFIG',
      'DEFAULT_FALLBACK',
      'SELF_REPORT'
    );
  ELSE
    ALTER TYPE "public"."severity_source"
      ADD VALUE IF NOT EXISTS 'SELF_REPORT';
  END IF;
END $$;

ALTER TABLE "agridata_reports"
  ADD COLUMN IF NOT EXISTS "severity_source" "public"."severity_source";
