import { createClient } from "@supabase/supabase-js";
import { db } from "../src/server/db/index.js";
import { appUsers, organizations } from "../src/server/db/schema.js";
import { eq } from "drizzle-orm";
import { env } from "../src/env.js";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const fullName = process.argv[4] || "Super Admin";

  if (!email || !password) {
    console.error("Usage: npm run bootstrap-admin <email> <password> [fullName]");
    process.exit(1);
  }

  console.log(`🚀 Bootstrapping Super Admin: ${email}...`);

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars in .env");
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Ensure "Internal" Organization exists
  let internalOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "internal"),
  });

  if (!internalOrg) {
    console.log("Creating 'Internal' organization...");
    const [newOrg] = await db.insert(organizations).values({
      name: "Internal",
      slug: "internal",
    }).returning();
    internalOrg = newOrg;
  }

  // 2. Check/Create Supabase Auth User
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser) {
    console.log("Creating user in Supabase Auth...");
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (createError) throw createError;
    authUser = createData.user;
    console.log(`✅ Created Auth user: ${authUser.id}`);
  } else {
    console.log(`User already exists in Auth (${authUser.id}). Updating password and confirming...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true
    });
    if (updateError) throw updateError;
    console.log("✅ Auth user updated.");
  }

  // 3. Create or Update app_users entry
  const existingAppUser = await db.query.appUsers.findFirst({
    where: eq(appUsers.authId, authUser.id),
  });

  if (existingAppUser) {
    console.log("Updating existing profile to Super Admin...");
    await db.update(appUsers)
      .set({
        role: "super_admin",
        orgId: internalOrg!.id,
        email: authUser.email,
        fullName: fullName,
        isActive: true,
      })
      .where(eq(appUsers.id, existingAppUser.id));
  } else {
    console.log("Creating new Super Admin profile...");
    await db.insert(appUsers).values({
      authId: authUser.id,
      email: authUser.email,
      fullName: fullName,
      orgId: internalOrg!.id,
      role: "super_admin",
      isActive: true,
    });
  }

  console.log(`\n✨ SUCCESS!`);
  console.log(`Email: ${email}`);
  console.log(`Role: Super Admin`);
  console.log(`You can now log in at /login`);
  
  process.exit(0);
}

main().catch((err) => {
    console.error("❌ Bootstrap failed:", err.message);
    process.exit(1);
});
