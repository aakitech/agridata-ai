import { db } from "../src/server/db";
import { organizations, appUsers, reports } from "../src/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { AlertsService } from "../src/server/modules/alerts/alerts-service";

async function main() {
  console.log("Seeding test data for Dashboard v1...");

  // 1. Find MPBC(Test) org
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.name, "MPBC(Test)"),
  });

  if (!org) {
    console.error("Organization 'MPBC(Test)' not found. Please create it first in the UI or via another script.");
    process.exit(1);
  }

  console.log(`Found organization: ${org.name} (${org.id})`);

  // 2. Find or create a test officer
  let officer = await db.query.appUsers.findFirst({
    where: eq(appUsers.orgId, org.id),
  });

  if (!officer) {
    console.log("Creating test officer...");
    const [newOfficer] = await db.insert(appUsers).values({
      orgId: org.id,
      fullName: "Test Officer",
      role: "officer",
      status: "ACTIVE",
      phoneNumber: "+263700000000",
    }).returning();
    officer = newOfficer;
  }
  
  if (!officer) throw new Error("Could not find or create officer");

  console.log(`Using officer: ${officer.fullName} (${officer.id})`);

  // 3. Setup AlertsService
  const alertsService = new AlertsService(db, org.id, "super_admin");

  // 4. Define locations in Zimbabwe
  const locations = [
    { name: "Harare", lat: -17.8252, lon: 31.0335, count: 2 }, // Normal
    { name: "Bulawayo", lat: -20.1465, lon: 28.5833, count: 5 }, // Warning
    { name: "Mutare", lat: -18.9727, lon: 32.6695, count: 8 }, // Warning
    { name: "Gweru", lat: -19.4600, lon: 29.8000, count: 12 }, // High
    { name: "Masvingo", lat: -20.0637, lon: 30.8277, count: 25 }, // High
    { name: "Chinhoyi", lat: -17.3500, lon: 30.2000, count: 3 }, // Normal
    { name: "Bindura", lat: -17.2990, lon: 31.3280, count: 7 }, // Warning
    { name: "Marondera", lat: -18.1853, lon: 31.5519, count: 18 }, // High
  ];

  const pestKey = "Moth";

  // 5. Create reports
  console.log("Inserting reports...");
  for (const loc of locations) {
    const { severity, source } = await alertsService.computeSeverity(org.id, pestKey, loc.count);
    
    // Randomize time slightly within the last 7 days
    const daysAgo = Math.floor(Math.random() * 7);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    await db.insert(reports).values({
      orgId: org.id,
      userId: officer.id,
      label: pestKey,
      observedCount: loc.count,
      severity: severity,
      severitySource: source,
      location: `POINT(${loc.lon} ${loc.lat})`,
      status: "VERIFIED",
      category: "PEST",
      createdAt: createdAt,
    });
    
    console.log(`Created report for ${loc.name}: count=${loc.count}, severity=${severity}, source=${source}`);
  }

  console.log("Seeding finished successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
