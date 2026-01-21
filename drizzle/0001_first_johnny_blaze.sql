CREATE TYPE "public"."enhancement_type" AS ENUM('label_hint', 'quality', 'context', 'follow_up', 'internal');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('ACTIVE', 'COMPLETED', 'RESET');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'org_admin', 'officer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "agridata_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active_workflow" text,
	"workflow_config" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "agridata_organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "agridata_report_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"media_url" text NOT NULL,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agridata_triage_enhancements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"enhancement_type" "enhancement_type" NOT NULL,
	"enhancement_text" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agridata_bot_users" RENAME TO "agridata_app_users";--> statement-breakpoint
ALTER TABLE "agridata_app_users" DROP CONSTRAINT "agridata_bot_users_phone_number_unique";--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" DROP CONSTRAINT "agridata_bot_sessions_user_id_agridata_bot_users_id_fk";
--> statement-breakpoint
ALTER TABLE "agridata_reports" DROP CONSTRAINT "agridata_reports_user_id_agridata_bot_users_id_fk";
--> statement-breakpoint
ALTER TABLE "agridata_app_users" ALTER COLUMN "phone_number" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "agridata_app_users" ALTER COLUMN "phone_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD COLUMN "current_step" text;--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD COLUMN "data_collected" jsonb;--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD COLUMN "status" "session_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "org_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "auth_id" uuid;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "role" "user_role" DEFAULT 'officer' NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "status" "user_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "org_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "workflow_id" text;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "quantity" text;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "data_payload" jsonb;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "diagnosis" text;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "risk_level" "risk_level";--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "verified_by" uuid;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "enhancement_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD COLUMN "last_enhancement_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agridata_report_media" ADD CONSTRAINT "agridata_report_media_report_id_agridata_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."agridata_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_triage_enhancements" ADD CONSTRAINT "agridata_triage_enhancements_report_id_agridata_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."agridata_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_triage_enhancements" ADD CONSTRAINT "agridata_triage_enhancements_added_by_agridata_app_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."agridata_app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "triage_enhancements_report_id_idx" ON "agridata_triage_enhancements" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "triage_enhancements_added_by_idx" ON "agridata_triage_enhancements" USING btree ("added_by");--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD CONSTRAINT "agridata_bot_sessions_user_id_agridata_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."agridata_app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD CONSTRAINT "agridata_app_users_org_id_agridata_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."agridata_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD CONSTRAINT "agridata_reports_org_id_agridata_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."agridata_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD CONSTRAINT "agridata_reports_user_id_agridata_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."agridata_app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_id_idx" ON "agridata_app_users" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "org_id_idx" ON "agridata_app_users" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "agridata_app_users" DROP COLUMN "language_pref";--> statement-breakpoint
ALTER TABLE "agridata_app_users" ADD CONSTRAINT "agridata_app_users_phone_number_unique" UNIQUE("phone_number");--> statement-breakpoint
ALTER TABLE "public"."agridata_bot_sessions" ALTER COLUMN "current_state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."bot_state" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."bot_state" AS ENUM('IDLE', 'AWAITING_LABEL', 'AWAITING_PHOTO_COUNT', 'AWAITING_LOCATION');--> statement-breakpoint
ALTER TABLE "public"."agridata_bot_sessions" ALTER COLUMN "current_state" SET DATA TYPE "public"."bot_state" USING "current_state"::"public"."bot_state";