import { db } from "./src/server/db/index.js";
import { appUsers } from "./src/server/db/schema.js";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { env } from "./src/env";

async function main() {
  const email = process.argv[2];
  const role = process.argv[3] as "super_admin" | "admin" | "officer" | undefined;

  if (!email) {
    console.error("Usage: npx tsx promote-user.ts \"Full Name\" [role]");
    console.error("Example: npx tsx promote-user.ts \"John Doe\" admin");
    return;
  }

  const targetRole = role || "super_admin";

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`Checking user: ${email}...`);

  // 1. Try to find in Supabase Auth by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  // 2. Find user in internal DB
  const user = await db.query.appUsers.findFirst({
    where: (u, { eq, or }) => or(
        eq(u.fullName, email), 
        eq(u.phoneNumber, email),
        authUser ? eq(u.authId, authUser.id) : undefined
    ),
  });

  if (!user) {
    console.error(`User ${email} not found.`);
    return;
  }

  await db.update(appUsers)
    .set({ role: targetRole })
    .where(eq(appUsers.id, user.id));

  console.log(`User ${user.fullName} updated to role: ${targetRole}`);
}

main().catch(console.error);
