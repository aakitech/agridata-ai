import { db } from "../src/server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking agridata_reports columns...");
  const result = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'agridata_reports'
  `);
  console.log(result);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
