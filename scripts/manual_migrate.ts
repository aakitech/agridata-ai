import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm"; // sql is imported from lib, usually safe or light

// Load .env manually
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      const val = value.join("=").trim().replace(/^["'](.*)["']$/, '$1');
      process.env[key.trim()] = val;
    }
  });
}

async function runMigration() {
  console.log("Running manual migration...");
  
  // Dynamic import AFTER env vars are loaded
  const { db } = await import("../src/server/db/index");

  const migrationPath = path.join(process.cwd(), "drizzle", "0001_seed_internal_org.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  try {
    await db.execute(sql.raw(migrationSql));
    console.log("Migration executed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigration();
