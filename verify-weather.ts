
import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const enriched = await db.execute(sql`
      SELECT 
        report_id, 
        status, 
        rain_day_mm, 
        temp_min_c, 
        temp_max_c, 
        fetched_at 
      FROM agridata_report_weather 
      WHERE status = 'OK'
      LIMIT 10
    `);
    console.log("Enriched Weather Records:", JSON.stringify(enriched, null, 2));
  } catch (err) {
    console.error("Verification failed:", err);
  }
  process.exit(0);
}

main();
