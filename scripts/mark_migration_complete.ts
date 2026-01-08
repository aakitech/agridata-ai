import postgres from "postgres";
import { env } from "~/env";

const sql = postgres(env.DATABASE_URL);

async function markMigrationComplete() {
  try {
    console.log("Checking current migrations...");
    const migrations = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at DESC
    `;
    console.log("Current migrations:", migrations);

    console.log("\nMarking migration 0002 as complete...");
    const timestamp = Date.now();
    
    // Check if it already exists
    const existing = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      WHERE hash = '0002_add_roles_enhancements'
    `;
    
    if (existing.length > 0) {
      console.log("Migration 0002 is already marked as complete!");
    } else {
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES ('0002_add_roles_enhancements', ${timestamp})
      `;
      console.log("✅ Migration 0002 marked as complete!");
    }
    
    const updated = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at DESC
    `;
    console.log("\nUpdated migrations:", updated);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

markMigrationComplete();
