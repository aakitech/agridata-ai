import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

// Load .env manually
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      const val = value.join("=").trim().replace(/^["'](.*)["']$/, "$1");
      process.env[key.trim()] = val;
    }
  });
}

async function runMigration() {
  console.log("Running severity source migration...");

  // Dynamic import AFTER env vars are loaded
  const { db } = await import("../src/server/db/index");

  // Helper to run SQL and ignore "already exists" errors
  const runSql = async (query: string, label: string) => {
    console.log(`Executing ${label}...`);
    try {
      await db.execute(sql.raw(query));
      console.log(`  ✅ Success: ${label}`);
    } catch (e: any) {
      if (
        e.message.includes("already exists") ||
        e.message.includes("duplicate") ||
        e.code === "42P07" // duplicate_table
      ) {
        console.log(`  ⏭️  Skip: ${label} (already exists)`);
      } else {
        console.error(`  ❌ Error in ${label}:`, e.message);
        throw e;
      }
    }
  };

  try {
    // Step 1: Create severity_source enum (PostgreSQL doesn't support IF NOT EXISTS for types)
    await runSql(
      `CREATE TYPE severity_source AS ENUM ('ORG_CONFIG', 'DEFAULT_FALLBACK');`,
      "Create severity_source enum"
    );

    // Step 2: Add severity_source column to reports table
    await runSql(
      `ALTER TABLE agridata_reports ADD COLUMN IF NOT EXISTS severity_source severity_source;`,
      "Add severity_source column"
    );

    console.log("✅ Migration executed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();

