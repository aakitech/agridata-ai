import { db } from "../src/server/db/index.ts";
import { appUsers } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";

/**
 * Script to fix blocked users by reactivating them
 * 
 * Usage: npx tsx --env-file=.env scripts/fix-blocked-user.ts <phone_number>
 */

async function fixUser(phoneInput: string) {
  console.log("🔧 Fixing WhatsApp Bot Access");
  console.log("═".repeat(60));
  
  // Normalize phone format
  const phoneClean = phoneInput.replace("whatsapp:", "");
  
  console.log(`\n📱 Looking for user: ${phoneClean}`);
  
  // Try to find user with various formats
  let user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneClean),
    with: { organization: true }
  });
  
  if (!user && phoneClean.startsWith("+")) {
    user = await db.query.appUsers.findFirst({
      where: eq(appUsers.phoneNumber, phoneClean.substring(1)),
      with: { organization: true }
    });
  }
  
  if (!user && !phoneClean.startsWith("+")) {
    user = await db.query.appUsers.findFirst({
      where: eq(appUsers.phoneNumber, `+${phoneClean}`),
      with: { organization: true }
    });
  }
  
  if (!user) {
    console.log("\n❌ User not found!");
    console.log("Cannot fix a user that doesn't exist.");
    console.log("Please invite the user first through the admin dashboard.");
    process.exit(1);
  }
  
  console.log(`\n✅ Found user: ${user.fullName || user.phoneNumber}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Current isActive: ${user.isActive}`);
  console.log(`   Current status: ${user.status}`);
  
  // Check what needs fixing
  const needsFix = !user.isActive || user.status !== "ACTIVE";
  
  if (!needsFix) {
    console.log("\n✅ User is already active!");
    console.log("No fixes needed.");
    process.exit(0);
  }
  
  console.log("\n🔧 Applying fixes...");
  
  // Update user
  const [updated] = await db
    .update(appUsers)
    .set({
      isActive: true,
      status: "ACTIVE"
    })
    .where(eq(appUsers.id, user.id))
    .returning();
  
  if (updated) {
    console.log("\n✅ USER FIXED SUCCESSFULLY!");
    console.log("─".repeat(60));
    console.log(`   isActive: ${updated.isActive}`);
    console.log(`   status: ${updated.status}`);
    console.log("\nThe user should now be able to access the WhatsApp bot.");
    
    // Check organization workflow
    if (!user.organization?.activeWorkflow) {
      console.log("\n⚠️  WARNING: Organization has no active workflow!");
      console.log("   Run: npm run seed:workflows");
    }
  } else {
    console.log("\n❌ Failed to update user");
  }
  
  console.log("\n" + "═".repeat(60));
}

const phoneArg = process.argv[2];

if (!phoneArg) {
  console.error("❌ Usage: npx tsx --env-file=.env scripts/fix-blocked-user.ts <phone_number>");
  console.error("   Example: npx tsx --env-file=.env scripts/fix-blocked-user.ts +27794979611");
  process.exit(1);
}

fixUser(phoneArg)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Error:", error);
    process.exit(1);
  });
