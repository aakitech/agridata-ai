import { db } from "./src/server/db/index.js";
import { appUsers } from "./src/server/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide the full name or phone of the user to promote.");
    return;
  }

  // Find user by name for simplicity in this dev script
  const user = await db.query.appUsers.findFirst({
    where: (u, { eq, or }) => or(eq(u.fullName, email), eq(u.phoneNumber, email)),
  });

  if (!user) {
    console.error(`User ${email} not found.`);
    return;
  }

  await db.update(appUsers)
    .set({ role: "super_admin" })
    .where(eq(appUsers.id, user.id));

  console.log(`User ${user.fullName} promoted to super_admin!`);
}

main().catch(console.error);
