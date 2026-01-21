import postgres from "postgres";
import { env } from "~/env";

const sql = postgres(env.DATABASE_URL);

async function removeBadMigration() {
  try {
    console.log("🔍 Checking current migrations...\n");
    
    const before = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at DESC
    `;
    console.log("📋 Migrations before removal:");
    before.forEach((m) => {
      const date = new Date(Number(m.created_at));
      console.log(`  - ${m.hash} (${date.toISOString()})`);
    });
    
    // Check if migration exists
    const migration0001 = before.find(m => m.hash === '0001_first_johnny_blaze');
    
    if (!migration0001) {
      console.log("\n✅ Migration 0001_first_johnny_blaze is not in tracking table.");
      console.log("   No action needed!");
      return;
    }
    
    console.log("\n⚠️  Removing migration 0001_first_johnny_blaze from tracking...");
    
    await sql`
      DELETE FROM drizzle.__drizzle_migrations 
      WHERE hash = '0001_first_johnny_blaze'
    `;
    
    console.log("✅ Migration removed successfully!\n");
    
    const after = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at DESC
    `;
    console.log("📋 Migrations after removal:");
    after.forEach((m) => {
      const date = new Date(Number(m.created_at));
      console.log(`  - ${m.hash} (${date.toISOString()})`);
    });
    
    console.log("\n✅ Done! You can now re-run migrations.");
    console.log("   The migration will run again from scratch.");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

removeBadMigration();
