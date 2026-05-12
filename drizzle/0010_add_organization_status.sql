DO $$ BEGIN
  CREATE TYPE "public"."organization_status" AS ENUM(
    'DRAFT',
    'CONFIGURING',
    'READY_FOR_TEST',
    'ACTIVE',
    'SUSPENDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "agridata_organizations"
  ADD COLUMN IF NOT EXISTS "status" "organization_status" DEFAULT 'DRAFT' NOT NULL;

ALTER TABLE "agridata_organizations"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;

UPDATE "agridata_organizations"
SET "status" = 'ACTIVE'
WHERE "slug" IN ('internal', 'mpbc');
