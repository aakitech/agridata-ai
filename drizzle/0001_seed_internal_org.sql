DO $$ BEGIN
    CREATE TYPE "public"."user_role" AS ENUM('admin', 'officer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "agridata_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "agridata_organizations_slug_unique" UNIQUE("slug")
);

-- Seed Internal Org with fixed ID
INSERT INTO "agridata_organizations" ("id", "name", "slug")
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Internal', 'internal')
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE IF NOT EXISTS "agridata_app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"auth_id" uuid,
	"phone_number" varchar(50),
	"full_name" text,
	"role" "user_role" DEFAULT 'officer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "agridata_app_users_phone_number_unique" UNIQUE("phone_number")
);

-- Migrate bot_users to app_users (Reusing IDs)
-- Check if bot_users table exists before selecting from it
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'agridata_bot_users') THEN
        INSERT INTO "agridata_app_users" ("id", "phone_number", "org_id", "created_at", "role", "is_active")
        SELECT "id", "phone_number", 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', "created_at", 'officer', true
        FROM "agridata_bot_users"
        ON CONFLICT ("phone_number") DO NOTHING;
    END IF;
END $$;

-- Modify Reports
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "org_id" uuid DEFAULT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' NOT NULL;
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "quantity" text;
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "risk_level" "risk_level";
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "diagnosis" text;
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;
ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "verified_by" uuid;

DO $$ BEGIN
 ALTER TABLE "agridata_app_users" ADD CONSTRAINT "agridata_app_users_org_id_agridata_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."agridata_organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "agridata_reports" ADD CONSTRAINT "agridata_reports_org_id_agridata_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."agridata_organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Update FKs for reports (user_id)
ALTER TABLE "agridata_reports" DROP CONSTRAINT IF EXISTS "agridata_reports_user_id_agridata_bot_users_id_fk";

DO $$ BEGIN
 ALTER TABLE "agridata_reports" ADD CONSTRAINT "agridata_reports_user_id_agridata_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."agridata_app_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Update FKs for bot_sessions
ALTER TABLE "agridata_bot_sessions" DROP CONSTRAINT IF EXISTS "agridata_bot_sessions_user_id_agridata_bot_users_id_fk";

DO $$ BEGIN
 ALTER TABLE "agridata_bot_sessions" ADD CONSTRAINT "agridata_bot_sessions_user_id_agridata_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."agridata_app_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Update Bot State Enum
ALTER TYPE "bot_state" ADD VALUE IF NOT EXISTS 'AWAITING_LABEL';
ALTER TYPE "bot_state" ADD VALUE IF NOT EXISTS 'AWAITING_PHOTO_COUNT';

-- Drop old table
DROP TABLE IF EXISTS "agridata_bot_users";

-- Create indexes
CREATE INDEX IF NOT EXISTS "phone_number_idx" ON "agridata_app_users" ("phone_number");
CREATE INDEX IF NOT EXISTS "auth_id_idx" ON "agridata_app_users" ("auth_id");
CREATE INDEX IF NOT EXISTS "org_id_idx" ON "agridata_app_users" ("org_id");

-- Create table report_media (was missing in 0000 but present in schema)
CREATE TABLE IF NOT EXISTS "agridata_report_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"media_url" text NOT NULL,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "agridata_report_media" ADD CONSTRAINT "agridata_report_media_report_id_agridata_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."agridata_reports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
