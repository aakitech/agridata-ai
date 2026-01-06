import { db } from "~/server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Adding 'label_hint' to 'enhancement_type' enum...");
  try {
    // Check if the value already exists to avoid errors on re-run
    const checkSql = sql`SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'enhancement_type' AND e.enumlabel = 'label_hint'`;
    const result = await db.execute(checkSql);
    
    if (result.length === 0) {
      await db.execute(sql`ALTER TYPE enhancement_type ADD VALUE 'label_hint' BEFORE 'quality'`);
      console.log("✅ Value 'label_hint' added successfully.");
    } else {
      console.log("ℹ️ Value 'label_hint' already exists.");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
