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
      const val = value.join("=").trim().replace(/^["'](.*)["']$/, '$1');
      process.env[key.trim()] = val;
    }
  });
}

async function runPatch() {
  console.log("Applying status patch...");
  
  const { db } = await import("../src/server/db/index");

  try {
    // 1. Create Enum
    await db.execute(sql.raw(`
        DO $$ BEGIN
            CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `));
    
    // 2. Add Column
    await db.execute(sql.raw(`
        ALTER TABLE agridata_app_users 
        ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'ACTIVE';
    `));

    console.log("Patch applied successfully.");
  } catch (error) {
    console.error("Patch failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

runPatch();
