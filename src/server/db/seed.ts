import { db } from "./index.js";
import { organizations, reports, appUsers, reportMedia } from "./schema.js";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";

const IMAGE_URLS = [
  "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800&q=80",
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80",
  "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&q=80",
  "https://images.unsplash.com/photo-1595113316349-9faec304395e?w=800&q=80",
  "https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800&q=80",
];

async function seed() {
  console.log("🌱 Seeding data...");

  // 1. Find or verify MPBC(Test)
  const mpbcTestId = '65c4a12a-f398-4be7-9cb6-7b8e9526e86d';
  let [org] = await db.select().from(organizations).where(eq(organizations.id, mpbcTestId));
  
  if (!org) {
    // Fallback search by slug
    [org] = await db.select().from(organizations).where(eq(organizations.slug, "mpbc-test-"));
  }

  if (!org) {
    console.error("Organization MPBC(Test) not found. Please create it first via the dashboard.");
    return;
  }

  console.log(`Using organization: ${org.name}`);

  // 2. Create some users/scouts
  const usersToCreate = [
    { fullName: "John Chirwa", phoneNumber: "+263771112223" },
    { fullName: "Sarah Moyo", phoneNumber: "+263771112224" },
    { fullName: "Tendai Sithole", phoneNumber: "+263771112225" },
    { fullName: "Grace Mutasa", phoneNumber: "+263771112226" },
  ];

  const createdUsers = [];
  for (const u of usersToCreate) {
    const [existing] = await db.select().from(appUsers).where(eq(appUsers.phoneNumber, u.phoneNumber));
    if (existing) {
      createdUsers.push(existing);
    } else {
      const [newUser] = await db.insert(appUsers).values({
        orgId: org.id,
        fullName: u.fullName,
        phoneNumber: u.phoneNumber,
        role: "officer",
      }).returning();
      createdUsers.push(newUser!);
    }
  }

  console.log(`Ensured ${createdUsers.length} users.`);

  // 3. Create dummy reports
  const pests = ["Fall Armyworm", "Maize Lethal Necrosis", "Locusts", "Leaf Rust", "Grey Leaf Spot"];
  const locations = [
    { name: "Harare", lon: 31.05, lat: -17.83 },
    { name: "Bulawayo", lon: 28.58, lat: -20.15 },
    { name: "Mutare", lon: 32.67, lat: -18.97 },
    { name: "Gweru", lon: 29.82, lat: -19.45 },
    { name: "Masvingo", lon: 30.83, lat: -20.07 },
    { name: "Chinhoyi", lon: 30.2, lat: -17.35 },
    { name: "Bindura", lon: 31.33, lat: -17.3 },
    { name: "Marondera", lon: 31.55, lat: -18.18 },
    { name: "Victoria Falls", lon: 25.84, lat: -17.93 },
    { name: "Beitbridge", lon: 29.99, lat: -22.21 },
    { name: "Kariba", lon: 28.8, lat: -16.52 },
    { name: "Hwange", lon: 26.48, lat: -18.37 },
    { name: "Chipinge", lon: 32.62, lat: -20.2 },
    { name: "Gwanda", lon: 29.0, lat: -20.94 },
  ];

  const statuses: Array<"PENDING_TRIAGE" | "VERIFIED" | "REJECTED"> = ["PENDING_TRIAGE", "VERIFIED", "REJECTED"];
  const riskLevels: Array<"LOW" | "MEDIUM" | "HIGH"> = ["LOW", "MEDIUM", "HIGH"];

  console.log("Generating reports...");

  for (let i = 0; i < 40; i++) {
    const user = createdUsers[i % createdUsers.length]!;
    const loc = locations[Math.floor(Math.random() * locations.length)]!;
    const status = i < 10 ? "PENDING_TRIAGE" : (i < 35 ? "VERIFIED" : "REJECTED");
    const risk = riskLevels[Math.floor(Math.random() * riskLevels.length)]!;
    const diagnosis = status === "VERIFIED" ? pests[Math.floor(Math.random() * pests.length)]! : null;
    
    // Spread over last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = subDays(new Date(), daysAgo);

    const imageUrl = IMAGE_URLS[i % IMAGE_URLS.length]!;
    
    const [newReport] = await db.insert(reports).values({
      orgId: org.id,
      userId: user.id,
      status: status,
      riskLevel: risk,
      diagnosis: diagnosis,
      mediaUrl: imageUrl,
      location: `POINT(${loc.lon} ${loc.lat})`,
      description: `Test report from ${loc.name} ${i}`,
      category: "PEST",
      createdAt: createdAt,
      verifiedAt: status !== "PENDING_TRIAGE" ? new Date() : null,
    }).returning();

    if (newReport && imageUrl) {
      // Add record to report_media table
      await db.insert(reportMedia).values({
        reportId: newReport.id,
        mediaUrl: imageUrl,
        contentType: "image/jpeg",
      });
    }

    // 4. Add some enhancements to first 5 reports
    if (i < 5 && newReport) {
      const { triageEnhancements } = await import("./schema.js");
      await db.insert(triageEnhancements).values({
        reportId: newReport.id,
        addedBy: user.id, // Just using the same scout for dummy data
        enhancementType: i % 2 === 0 ? "quality" : "context",
        enhancementText: i % 2 === 0 
          ? "Photo is slightly blurry but identifiable." 
          : "Nearby fields also showing similar symptoms.",
        isInternal: false,
      });

      // Update count
      await db.update(reports)
        .set({ enhancementCount: 1, lastEnhancementAt: new Date() })
        .where(eq(reports.id, newReport.id));
    }
  }

  console.log("✅ Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
