import { db } from "./src/server/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'user_role';
  `);
  
  console.log("Current user_role enum values in DB:");
  console.log(result.rows);
}

main().catch(console.error);
