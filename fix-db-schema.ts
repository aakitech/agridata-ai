import { db } from "./src/server/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding 'super_admin' to user_role enum...");
  
  try {
    // We use a DO block to handle the case where it might already exist in some environments but not others
    // ALTER TYPE ... ADD VALUE cannot be run inside a transaction/DO block in some Postgres versions, 
    // but we can try it directly.
    await db.execute(sql`ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'super_admin'`);
    console.log("✅ Successfully added 'super_admin' to user_role enum.");
  } catch (err: any) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️ 'super_admin' already exists in enum.");
    } else {
      console.error("❌ Error updating enum:", err.message);
      throw err;
    }
  }
}

main().catch(console.error);
