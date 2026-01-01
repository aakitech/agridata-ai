
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

// 1. Load .env manually (Fixes module resolution issues in scripts)
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

// 2. Dynamic Imports
const { db } = await import("../src/server/db/index");
const { appUsers, organizations } = await import("../src/server/db/schema");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function bootstrapAdmin(email: string) {
  if (!email) {
    console.error("❌ Please provide an email address.");
    console.log("Usage: npx tsx scripts/bootstrap_admin.ts <email>");
    process.exit(1);
  }

  console.log(`🔍 Looking for Supabase user: ${email}...`);
  
  // Note: listUsers is paginated, but for dev/bootstrap mostly fine.
  // Ideally use getUserById if we had ID, but we only have email.
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Supabase Error:", error.message);
    process.exit(1);
  }

  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ No user found with email ${email} in Supabase Auth.`);
    console.log("   Please sign up in the app first.");
    process.exit(1);
  }

  console.log(`✅ Found Auth User: ${user.id}`);

  // 2b. Auto-confirm email (Dev convenience)
  if (!user.email_confirmed_at) {
      console.log("📧 Auto-confirming user email...");
      const { error: confirmError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );
      if (confirmError) {
          console.warn("⚠️ Failed to auto-confirm email:", confirmError.message);
      } else {
          console.log("✅ Email confirmed.");
      }
  }

  // 3. Find Internal Org
  const internalOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "internal"),
  });

  if (!internalOrg) {
    console.error("❌ Internal Organization not found. Run migrations first.");
    process.exit(1);
  }

  console.log(`🏢 Linking to Organization: ${internalOrg.name}`);

  // 4. Upsert App User
  // Check if exists by Auth ID
  const existingUser = await db.query.appUsers.findFirst({
    where: eq(appUsers.authId, user.id),
  });

  if (existingUser) {
    console.log(`⚠️  User already exists in app_users. Updating role to 'super_admin'...`);
    await db.update(appUsers)
        .set({ role: "super_admin", isActive: true })
        .where(eq(appUsers.id, existingUser.id));
    console.log("✅ User updated.");
  } else {
    console.log(`✨ Creating new Super Admin User...`);
    await db.insert(appUsers).values({
        authId: user.id,
        orgId: internalOrg.id,
        role: "super_admin",
        fullName: email.split("@")[0], // Fallback name
        isActive: true,
    });
    console.log("✅ User created.");
  }
}

const email = process.argv[2] ?? "";
bootstrapAdmin(email).catch((e) => {
    console.error(e);
    process.exit(1);
});
