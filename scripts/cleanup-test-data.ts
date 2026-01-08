import { db } from "../src/server/db/index.js";
import { appUsers, botSessions, reports } from "../src/server/db/schema.js";
import { eq, inArray } from "drizzle-orm";

async function cleanupTestData() {
  console.log("🧹 Cleaning up test data...");

  const testPhoneNumbers = ["+263770000000", "+263779999999"];

  // Find users
  const users = await db.query.appUsers.findMany({
    where: inArray(appUsers.phoneNumber, testPhoneNumbers)
  });

  if (users.length === 0) {
    console.log("No test users found to clean up.");
    process.exit(0);
  }

  const userIds = users.map(u => u.id);

  // 1. Delete Sessions
  await db.delete(botSessions).where(inArray(botSessions.userId, userIds));
  console.log("✅ Deleted bot sessions");

  // 2. Delete Reports (Cascades to media/enhancements usually, but let's be safe)
  await db.delete(reports).where(inArray(reports.userId, userIds));
  console.log("✅ Deleted reports");

  // 3. Delete Users
  await db.delete(appUsers).where(inArray(appUsers.id, userIds));
  console.log(`✅ Deleted ${users.length} test users`);

  console.log("🧹 Cleanup complete!");
  process.exit(0);
}

cleanupTestData();
