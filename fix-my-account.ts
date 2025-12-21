import { createClient } from "@supabase/supabase-js";
import { db } from "./src/server/db/index.js";
import { appUsers, organizations } from "./src/server/db/schema.js";
import { eq } from "drizzle-orm";
import { env } from "./src/env.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx fix-my-account.ts <email>");
    return;
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    return;
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log(`[1/4] Checking Supabase Auth for ${email}...`);
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const authUser = users.find(u => u.email === email);
  if (!authUser) {
    console.error(`❌ User ${email} not found in Supabase Auth. Please sign up first.`);
    return;
  }

  console.log(`[2/4] Confirming email for ${authUser.id}...`);
  await supabase.auth.admin.updateUserById(authUser.id, { email_confirm: true });

  console.log(`[3/4] Checking internal profile...`);
  const existingProfile = await db.query.appUsers.findFirst({
    where: eq(appUsers.authId, authUser.id),
  });

  let userId = existingProfile?.id;

  if (!existingProfile) {
    console.log("No profile found. Creating one...");
    const internalOrg = await db.query.organizations.findFirst({
        where: eq(organizations.slug, "internal"),
    });

    if (!internalOrg) throw new Error("Internal organization not found. please run seed first.");

    const [newProfile] = await db.insert(appUsers).values({
      authId: authUser.id,
      fullName: "Test Admin",
      orgId: internalOrg.id,
      role: "super_admin",
      isActive: true,
    }).returning();
    userId = newProfile.id;
    console.log("✅ Profile created and promoted.");
  } else {
    console.log("Profile found. Promoting to super_admin...");
    await db.update(appUsers)
      .set({ role: "super_admin" })
      .where(eq(appUsers.authId, authUser.id));
    console.log("✅ Profile promoted.");
  }

  console.log("\n🚀 Done! You can now log in with:");
  console.log(`Email: ${email}`);
  console.log("Password: (the one you used at signup)");
}

main().catch(err => console.error("❌ Fatal Error:", err));
