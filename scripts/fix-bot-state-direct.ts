import postgres from "postgres";

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function fixBotStateType() {
  try {
    console.log("🔧 Fixing bot_state type directly...\n");
    
    // Run the idempotent fix directly
    await sql.unsafe(`
      DO $$ 
      BEGIN
        -- Step 1: Convert column to text if it exists and isn't already text
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = 'agridata_bot_sessions' 
          AND column_name = 'current_state'
          AND data_type != 'text'
        ) THEN
          RAISE NOTICE 'Converting current_state column to text...';
          ALTER TABLE "public"."agridata_bot_sessions" 
          ALTER COLUMN "current_state" SET DATA TYPE text;
        ELSE
          RAISE NOTICE 'Column is already text or does not exist, skipping...';
        END IF;

        -- Step 2: Drop type if exists (CASCADE to handle any remaining dependencies)
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bot_state') THEN
          RAISE NOTICE 'Dropping existing bot_state type...';
          DROP TYPE "public"."bot_state" CASCADE;
        ELSE
          RAISE NOTICE 'Type bot_state does not exist, skipping drop...';
        END IF;
        
        -- Step 3: Create the type with correct enum values
        RAISE NOTICE 'Creating bot_state type with correct values...';
        CREATE TYPE "public"."bot_state" AS ENUM(
          'IDLE', 
          'AWAITING_LABEL', 
          'AWAITING_PHOTO_COUNT', 
          'AWAITING_LOCATION'
        );
        
        -- Step 4: Convert column back to enum type
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = 'agridata_bot_sessions' 
          AND column_name = 'current_state'
        ) THEN
          RAISE NOTICE 'Converting current_state back to bot_state enum...';
          ALTER TABLE "public"."agridata_bot_sessions" 
          ALTER COLUMN "current_state" 
          SET DATA TYPE "public"."bot_state" 
          USING "current_state"::"public"."bot_state";
          
          RAISE NOTICE 'Fix completed successfully!';
        END IF;
        
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Error during fix: %', SQLERRM;
          RAISE;
      END $$;
    `);
    
    console.log("✅ bot_state type fixed successfully!");
    console.log("   The type now has the correct enum values.");
    console.log("   Migrations can now run safely.\n");
    
  } catch (error) {
    console.error("❌ Error fixing bot_state type:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

fixBotStateType();
