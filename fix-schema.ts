import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function fixSchema() {
  console.log("Fixing phone_number column length...");
  
  try {
    await db.execute(sql`
      ALTER TABLE agridata_bot_users 
      ALTER COLUMN phone_number TYPE varchar(50);
    `);
    console.log("✅ Schema fixed successfully!");
  } catch (error) {
    console.error("❌ Error fixing schema:", error);
  }
  
  process.exit(0);
}

fixSchema();
