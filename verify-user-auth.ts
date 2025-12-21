import { createClient } from "@supabase/supabase-js";
import { env } from "./src/env.js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx verify-user-auth.ts <email>");
    return;
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    return;
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log(`Checking user: ${email}...`);

  // Use admin API to list users and find the one with this email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing users:", listError.message);
    return;
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`User with email ${email} not found in Supabase Auth.`);
    return;
  }

  console.log(`User found: ${user.id}`);
  console.log(`Confirmed at: ${user.email_confirmed_at || "NOT CONFIRMED"}`);

  if (!user.email_confirmed_at) {
    console.log("Attempting to manually confirm user...");
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error("Error confirming user:", updateError.message);
    } else {
      console.log("✅ User manually confirmed!");
    }
  } else {
    console.log("User is already confirmed.");
  }
}

main().catch(console.error);
