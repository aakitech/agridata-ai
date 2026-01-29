import { db } from "../src/server/db";
import { organizations } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { ReportService } from "../src/server/modules/reports/report-service";
import { subDays, startOfDay, endOfDay } from "date-fns";

async function main() {
  console.log("🔍 Verifying MPBC report data generation with geocoding...");

  // 1. Find MPBC org
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "mpbc"),
  });

  if (!org) {
    console.error("❌ Organization 'MPBC' not found.");
    process.exit(1);
  }

  const reportService = new ReportService(db);
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(subDays(endDate, 7));

  console.log(`📅 Building report for ${org.name} from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

  try {
    const reportData = await reportService.buildMpbcWeeklyReport(org.id, startDate, endDate);

    console.log("\n📊 Summary Metrics:");
    console.log(`   - Total Reports: ${reportData.summaryMetrics.totalReports}`);
    console.log(`   - High Alert Reports: ${reportData.summaryMetrics.highAlertCount}`);
    
    console.log("\n📍 Checking Geocoding (All Reports Sample):");
    const sampleSize = Math.min(reportData.allReports.length, 5);
    for (let i = 0; i < sampleSize; i++) {
        const r = reportData.allReports[i];
        console.log(`   Report ${i+1}:`);
        console.log(`     Officer: ${r.user?.fullName || "N/A"}`);
        console.log(`     Location (Raw): ${r.location}`);
        console.log(`     Location (Geocoded): ${r.geocodedLocation || "❌ FAILED OR NOT DATA"}`);
    }

    if (reportData.allReports.length > 0) {
        const hasGeocoded = reportData.allReports.some(r => r.geocodedLocation);
        if (hasGeocoded) {
            console.log("\n✅ SUCCESS: Found reports with geocoded locations!");
        } else {
            console.log("\n⚠️ WARNING: No reports have geocoded locations. This might be due to rate limiting or no coordinate data.");
        }
    } else {
        console.log("\nℹ️ No reports found in this period to verify.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
