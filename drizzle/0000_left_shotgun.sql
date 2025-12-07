CREATE TYPE "public"."bot_state" AS ENUM('IDLE', 'AWAITING_MENU_CHOICE', 'AWAITING_PHOTO', 'AWAITING_LOCATION', 'AWAITING_DESCRIPTION');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('PEST', 'DISEASE', 'WEATHER');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('DRAFT', 'PENDING_TRIAGE', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "agridata_bot_sessions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_state" "bot_state" DEFAULT 'IDLE' NOT NULL,
	"draft_report_id" uuid,
	"last_active" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "agridata_bot_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"language_pref" varchar(10) DEFAULT 'en',
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "agridata_bot_users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "agridata_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "report_status" DEFAULT 'DRAFT' NOT NULL,
	"category" "report_category",
	"media_url" text,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD CONSTRAINT "agridata_bot_sessions_user_id_agridata_bot_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."agridata_bot_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_bot_sessions" ADD CONSTRAINT "agridata_bot_sessions_draft_report_id_agridata_reports_id_fk" FOREIGN KEY ("draft_report_id") REFERENCES "public"."agridata_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agridata_reports" ADD CONSTRAINT "agridata_reports_user_id_agridata_bot_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."agridata_bot_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_number_idx" ON "agridata_bot_users" USING btree ("phone_number");