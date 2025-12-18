import fs from "fs";
import path from "path";
import { eq, inArray } from "drizzle-orm";

// Load .env manually
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value) {
      const val = value.join("=").trim().replace(/^["'](.*)["']$/, '$1');
      process.env[key.trim()] = val;
    }
  });
}

// Dynamic import needed after env vars are loaded
const { db } = await import("../src/server/db/index");
const { appUsers, botSessions, reports, reportMedia } = await import("../src/server/db/schema");

async function resetUser(phoneNumber: string) {
  if (!phoneNumber) {
    console.error("Please provide a phone number.");
    process.exit(1);
  }

  // Ensure format matches DB (e.g., whatsapp:+1234567890 or +1234567890)
  // We'll search for both if not sure, but exact match is safest.
  console.log(`🔍 Searching for user: ${phoneNumber}`);

  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneNumber),
  });

  if (!user) {
    console.log("❌ User not found.");
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.fullName} (${user.id})`);
  console.log("🗑️  Cleaning up data...");

  // 1. Delete Sessions FIRST (This removes the lock on 'draft_report_id' linking to reports)
  await db.delete(botSessions).where(eq(botSessions.userId, user.id));
  console.log(`   - Deleted bot sessions`);

  // 2. Find user's reports to delete related media
  const userReports = await db.query.reports.findMany({
    where: eq(reports.userId, user.id),
    columns: { id: true },
  });

  const reportIds = userReports.map((r) => r.id);

  if (reportIds.length > 0) {
    // Delete Media
    await db.delete(reportMedia).where(inArray(reportMedia.reportId, reportIds));
    console.log(`   - Deleted media for ${reportIds.length} reports`);

    // Delete Reports
    await db.delete(reports).where(inArray(reports.id, reportIds));
    console.log(`   - Deleted ${reportIds.length} reports`);
  } else {
    console.log(`   - No reports found.`);
  }

  // 3. Delete User
  await db.delete(appUsers).where(eq(appUsers.id, user.id));
  console.log(`✅ User deleted successfully.`);
}

const phoneNumber = process.argv[2];
if (!phoneNumber) {
    console.log("Usage: npx tsx scripts/reset_user.ts <phone_number>");
} else {
    resetUser(phoneNumber).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
