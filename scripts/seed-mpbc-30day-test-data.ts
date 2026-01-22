import { db } from "../src/server/db";
import { organizations, appUsers, reports } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { AlertsService } from "../src/server/modules/alerts/alerts-service";
import { subDays, setHours, setMinutes, setSeconds } from "date-fns";

async function main() {
  console.log("🌱 Seeding MPBC test data from December 9th...");

  // 1. Find MPBC org (by slug "mpbc")
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "mpbc"),
  });

  if (!org) {
    console.error("❌ Organization 'MPBC' (slug: mpbc) not found. Please create it first.");
    process.exit(1);
  }

  console.log(`✅ Found organization: ${org.name} (${org.id})`);

  // 2. Find or create test officers
  const officerNames = [
    "John Chirwa",
    "Sarah Moyo",
    "Tendai Sithole",
    "Grace Mutasa",
  ];

  const officers = [];
  for (const name of officerNames) {
    let officer = await db.query.appUsers.findFirst({
      where: (users, { and, eq }) =>
        and(eq(users.orgId, org.id), eq(users.fullName, name)),
    });

    if (!officer) {
      const phoneNumber = `+26377${Math.floor(1000000 + Math.random() * 9000000)}`;
      const [newOfficer] = await db
        .insert(appUsers)
        .values({
          orgId: org.id,
          fullName: name,
          role: "officer",
          status: "ACTIVE",
          phoneNumber: phoneNumber,
        })
        .returning();
      officer = newOfficer;
      console.log(`  Created officer: ${name}`);
    }
    if (officer) officers.push(officer);
  }

  if (officers.length === 0) {
    throw new Error("Could not find or create any officers");
  }

  console.log(`✅ Using ${officers.length} officers`);

  // 3. Setup AlertsService
  const alertsService = new AlertsService(db, org.id, "super_admin");

  // 4. Define locations in Zimbabwe
  const locations = [
    { name: "Harare", lat: -17.8252, lon: 31.0335 },
    { name: "Bulawayo", lat: -20.1465, lon: 28.5833 },
    { name: "Mutare", lat: -18.9727, lon: 32.6695 },
    { name: "Gweru", lat: -19.4600, lon: 29.8000 },
    { name: "Masvingo", lat: -20.0637, lon: 30.8277 },
    { name: "Chinhoyi", lat: -17.3500, lon: 30.2000 },
    { name: "Bindura", lat: -17.2990, lon: 31.3280 },
    { name: "Marondera", lat: -18.1853, lon: 31.5519 },
    { name: "Kadoma", lat: -18.3333, lon: 29.9167 },
    { name: "Chitungwiza", lat: -18.0167, lon: 31.0833 },
  ];

  const pestKey = "Moth"; // MPBC uses "Moth" for African Armyworm

  // 5. Generate reports from December 9th to today
  const today = new Date();
  const startDate = new Date("2025-12-09T00:00:00Z"); // December 9th, 2025
  const daysDiff = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log(`📅 Generating reports from Dec 9, 2025 to today (${daysDiff} days)...`);

  // Generate 2-3 reports per day to have good coverage
  const reportsPerDay = 2;
  const totalReports = daysDiff * reportsPerDay;

  let created = 0;
  let skipped = 0;

  for (let dayOffset = 0; dayOffset < daysDiff; dayOffset++) {
    const reportDate = subDays(today, dayOffset);
    
    // Generate 2-3 reports for this day
    for (let reportIdx = 0; reportIdx < reportsPerDay; reportIdx++) {
      // Randomize time within the day (8 AM to 6 PM)
      const hour = 8 + Math.floor(Math.random() * 10);
      const minute = Math.floor(Math.random() * 60);
      const createdAt = setSeconds(
        setMinutes(setHours(reportDate, hour), minute),
        0
      );

      // Random location
      const loc = locations[Math.floor(Math.random() * locations.length)]!;

      // Random count with some variety (0-50, weighted towards lower numbers)
      // This creates a mix of NORMAL, WARNING, and HIGH severity reports
      const random = Math.random();
      let count: number;
      if (random < 0.6) {
        // 60% chance: Normal range (0-5)
        count = Math.floor(Math.random() * 6);
      } else if (random < 0.85) {
        // 25% chance: Warning range (6-10)
        count = 6 + Math.floor(Math.random() * 5);
      } else {
        // 15% chance: High range (11-50)
        count = 11 + Math.floor(Math.random() * 40);
      }

      // Random officer
      const officer = officers[Math.floor(Math.random() * officers.length)]!;

      // Compute severity using AlertsService
      const { severity, source } = await alertsService.computeSeverity(
        org.id,
        pestKey,
        count
      );

      // Check if report already exists (avoid duplicates on re-run)
      const existing = await db.query.reports.findFirst({
        where: (reports, { and, eq, gte, lte }) =>
          and(
            eq(reports.orgId, org.id),
            eq(reports.userId, officer.id),
            eq(reports.label, pestKey),
            gte(reports.createdAt, new Date(createdAt.getTime() - 60000)), // Within 1 minute
            lte(reports.createdAt, new Date(createdAt.getTime() + 60000))
          ),
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Store count in dataPayload for consistency with MPBC workflow
      await db.insert(reports).values({
        orgId: org.id,
        userId: officer.id,
        label: pestKey,
        observedCount: count,
        severity: severity,
        severitySource: source,
        location: `POINT(${loc.lon} ${loc.lat})`,
        status: "VERIFIED",
        category: "PEST",
        workflowId: "mpbc_trap",
        dataPayload: {
          pest_name: pestKey,
          count: count,
        },
        createdAt: createdAt,
      });

      created++;
      if (created % 10 === 0) {
        console.log(`  Created ${created} reports...`);
      }
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   Created: ${created} reports`);
  console.log(`   Skipped: ${skipped} duplicates`);
  console.log(`   Date range: Dec 9, 2025 to ${today.toISOString().split("T")[0]}`);
  console.log(`\n📊 You can now test:`);
  console.log(`   - 7-day report: Should show last 7 days of data`);
  console.log(`   - 30-day report: Should show last 30 days of data`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});

