import { invitesRouter } from "../src/server/api/routers/invites.ts";
import { db } from "../src/server/db/index.ts";
import { appUsers } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";

async function verifyInviteLogic() {
  console.log("--- Verifying Officer Onboarding Logic ---");

  // Mock Context for a Super Admin
  const mockCtx = {
    db: db,
    user: { id: "test-auth-id" } as any, // Mock Supabase User
    appUser: { id: "test-admin", role: "super_admin", orgId: "any" } as any,
    session: null as any,
    headers: new Headers(),
  };

  const caller = invitesRouter.createCaller(mockCtx);

  // 1. Test Valid Officer Creation specific phone
  const phone = "+263771234567";
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // Internal Org

  try {
    // Clean up first
    const existing = await db.query.appUsers.findFirst({ where: eq(appUsers.phoneNumber, phone) });
    if (existing) await db.delete(appUsers).where(eq(appUsers.id, existing.id));

    const result = await caller.create({
      fullName: "Test Officer",
      role: "officer",
      orgId: orgId,
      phoneNumber: phone,
    });

    console.log("✅ Created Officer successfully:", result.userId);

    // Verify DB
    const user = await db.query.appUsers.findFirst({ where: eq(appUsers.id, result.userId) });
    if (user && user.phoneNumber === phone && user.email === null) {
      console.log("✅ DB Record correct: Phone set, Email null.");
    } else {
      console.error("❌ DB Record mismatch:", user);
    }

  } catch (e: any) {
    console.error("❌ Failed to create officer:", e.message);
  }

  // 2. Test Invalid Officer (No Phone)
  try {
    await caller.create({
      fullName: "Bad Officer",
      role: "officer",
      orgId: orgId,
      // No phone, no email
    } as any);
    console.error("❌ Should have failed missing phone!");
  } catch (e: any) {
    if (e.message.includes("Phone number is required")) {
        console.log("✅ Correctly rejected missing phone.");
    } else {
        console.error("❌ Unexpected error:", e.message);
    }
  }

  process.exit(0);
}

verifyInviteLogic();
