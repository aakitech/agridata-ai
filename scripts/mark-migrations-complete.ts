import postgres from "postgres";

// Get DATABASE_URL from environment variable directly
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function markMigrationsComplete() {
  try {
    console.log("🔧 Ensuring migration tracking table exists...\n");
    
    // Create the drizzle schema and migrations table if they don't exist
    await sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS drizzle;
      
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);
    
    console.log("✅ Migration tracking table ready\n");
    
    console.log("🔍 Checking existing migrations...\n");
    const existing = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `;
    
    console.log(`📋 Found ${existing.length} tracked migrations`);
    existing.forEach((m) => {
      console.log(`  - ${m.hash}`);
    });
    
    // Define migrations that should be marked as complete
    const migrationsToMark = [
      { hash: '0000_left_shotgun', when: 1764184931443 },
      { hash: '0001_first_johnny_blaze', when: 1767480791839 },
      { hash: '0002_add_roles_enhancements', when: 1736164800000 },
    ];
    
    console.log("\n🔧 Marking migrations as complete...\n");
    
    for (const migration of migrationsToMark) {
      const exists = existing.find(m => m.hash === migration.hash);
      
      if (exists) {
        console.log(`  ✓ ${migration.hash} already tracked`);
      } else {
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration.hash}, ${migration.when})
        `;
        console.log(`  ✅ ${migration.hash} marked as complete`);
      }
    }
    
    console.log("\n📊 Final migration state:");
    const final = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `;
    final.forEach((m) => {
      console.log(`  - ${m.hash}`);
    });
    
    console.log("\n✅ Migration tracking updated successfully!");
    
  } catch (error) {
    console.error("❌ Error marking migrations complete:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

markMigrationsComplete();
