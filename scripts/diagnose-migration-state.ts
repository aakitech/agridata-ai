import postgres from "postgres";
import { env } from "~/env";

const sql = postgres(env.DATABASE_URL);

async function diagnoseMigrationState() {
  try {
    console.log("🔍 Checking migration tracking table...\n");
    
    // Check migration tracking
    const migrations = await sql`
      SELECT * FROM drizzle.__drizzle_migrations 
      ORDER BY created_at DESC
    `;
    console.log("📋 Tracked migrations:");
    migrations.forEach((m) => {
      const date = new Date(Number(m.created_at));
      console.log(`  - ${m.hash} (${date.toISOString()})`);
    });
    
    console.log("\n🔍 Checking bot_state type...\n");
    
    // Check if type exists
    const typeExists = await sql`
      SELECT typname, typtype FROM pg_type WHERE typname = 'bot_state'
    `;
    
    if (typeExists.length > 0) {
      console.log("✅ bot_state type exists");
      
      // Get enum values
      const enumValues = await sql`
        SELECT enumlabel 
        FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'bot_state'
        ORDER BY enumsortorder
      `;
      console.log("   Enum values:", enumValues.map(e => e.enumlabel).join(", "));
    } else {
      console.log("❌ bot_state type does NOT exist");
    }
    
    console.log("\n🔍 Checking agridata_bot_sessions table...\n");
    
    // Check column type
    const columnInfo = await sql`
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns 
      WHERE table_name = 'agridata_bot_sessions' 
      AND column_name = 'current_state'
    `;
    
    if (columnInfo.length > 0) {
      console.log("📊 current_state column info:");
      console.log(`   Data type: ${columnInfo[0].data_type}`);
      console.log(`   UDT name: ${columnInfo[0].udt_name}`);
    } else {
      console.log("❌ current_state column does NOT exist");
    }
    
    // Check if migration 0001 is tracked but type is wrong
    const migration0001 = migrations.find(m => m.hash === '0001_first_johnny_blaze');
    const typeCorrect = enumValues?.length === 4 && 
                        enumValues.map(e => e.enumlabel).includes('AWAITING_LABEL');
    
    console.log("\n📊 Summary:");
    console.log(`   Migration 0001 tracked: ${!!migration0001 ? '✅' : '❌'}`);
    console.log(`   Type exists: ${typeExists.length > 0 ? '✅' : '❌'}`);
    console.log(`   Type correct: ${typeCorrect ? '✅' : '❌'}`);
    
    if (migration0001 && !typeCorrect) {
      console.log("\n⚠️  PROBLEM DETECTED:");
      console.log("   Migration is marked complete but type is incorrect!");
      console.log("   Recommended action: Remove migration from tracking and re-run");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

diagnoseMigrationState();
