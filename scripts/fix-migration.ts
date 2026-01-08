import { db } from "../src/server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying migration 0003 manually (refined)...");

  // Helper to run SQL and ignore "already exists" errors
  const runSql = async (query: string, label: string) => {
    console.log(`Executing ${label}...`);
    try {
      await db.execute(sql.raw(query));
      console.log(`  Success: ${label}`);
    } catch (e: any) {
      if (e.message.includes("already exists") || e.message.includes("already has a value")) {
        console.log(`  Skip: ${label} (already exists)`);
      } else {
        console.error(`  Error in ${label}:`, e.message);
      }
    }
  };

  // 1. Create Type (no IF NOT EXISTS in Postgres for types)
  await runSql(`CREATE TYPE severity AS ENUM ('NORMAL', 'WARNING', 'HIGH');`, "Create severity enum");

  // 2. Add columns
  await runSql(`ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "severity" severity;`, "Add severity column");
  await runSql(`ALTER TABLE "agridata_reports" ADD COLUMN IF NOT EXISTS "observed_count" integer;`, "Add observed_count column");

  // 3. Create table
  await runSql(`
    CREATE TABLE IF NOT EXISTS "agridata_org_alert_thresholds" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_id" uuid NOT NULL REFERENCES "agridata_organizations"("id") ON DELETE CASCADE,
      "pest_key" text NOT NULL,
      "normal_max" integer NOT NULL,
      "warning_max" integer NOT NULL,
      "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `, "Create org_alert_thresholds table");

  // 4. Indexes
  await runSql(`CREATE INDEX IF NOT EXISTS "idx_org_alert_thresholds_org_id" ON "agridata_org_alert_thresholds"("org_id");`, "Index org_id");
  await runSql(`CREATE INDEX IF NOT EXISTS "idx_org_alert_thresholds_pest_key" ON "agridata_org_alert_thresholds"("pest_key");`, "Index pest_key");
  await runSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_org_alert_thresholds_org_pest_unique" ON "agridata_org_alert_thresholds"("org_id", "pest_key");`, "Unique index org_pest");

  console.log("Migration application finished.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
