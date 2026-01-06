import { db } from "../src/server/db/index.ts";
import { appUsers } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";

async function reproducePrefixIssue() {
  const cleanPhone = "+27794979611";
  const twilioPhone = "whatsapp:+27794979611";

  console.log("--- Reproduction Test ---");

  // 1. Try with Prefix (Simulating Bug)
  console.log(`Testing query with: '${twilioPhone}'`);
  const userWithPrefix = await db.query.appUsers.findFirst({
      where: eq(appUsers.phoneNumber, twilioPhone)
  });
  console.log("Result (With Prefix):", userWithPrefix ? "✅ FOUND" : "❌ NOT FOUND");

  // 2. Try Clean (Simulating Fix)
  console.log(`Testing query with: '${cleanPhone}'`);
  const userClean = await db.query.appUsers.findFirst({
      where: eq(appUsers.phoneNumber, cleanPhone)
  });
  console.log("Result (Clean):", userClean ? "✅ FOUND" : "❌ NOT FOUND");

  process.exit(0);
}

reproducePrefixIssue();
