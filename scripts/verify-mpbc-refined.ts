
import { db } from "../src/server/db/index.ts";
import { appUsers, organizations, botSessions, reports } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";
import { handleIncomingMessage } from "../src/server/modules/whatsapp-bot/workflow.ts"; // We import the handler directly

// Mock Twilio client to prevent actual sending (or we just observe logs)
// Since we can't easily mock the client here without DI, we will rely on checking DB state changes.

async function verifyRefinedMPBC() {
  console.log("--- Verifying Refined MPBC Workflow ---");

  // 1. Setup Test User
  const phone = "+27794979611"; // The MPBC User
  const testUser = await db.query.appUsers.findFirst({
        where: eq(appUsers.phoneNumber, phone),
        with: { organization: true }
  });

  if (!testUser) throw new Error("Test user not found");
  
  // Reset Session
  await db.delete(botSessions).where(eq(botSessions.userId, testUser.id));

  // Helper to send message
  const send = async (body: string) => {
      console.log(`👤 User: ${body}`);
      await handleIncomingMessage({ From: `whatsapp:${phone}`, Body: body });
      
      // Fetch session to see bot's state
      const session = await db.query.botSessions.findFirst({ where: eq(botSessions.userId, testUser.id) });
      return session;
  };

  // Step 1: Start (Trigger Welcome)
  console.log("\n--- Step 1: Trigger Welcome ---");
  let session = await send("Hi");
  if (session?.currentStep === "pest_name") {
      console.log("✅ Bot is at 'pest_name' step.");
  } else {
      console.error("❌ Failed to start workflow correctly.", session);
  }

  // Step 2: Enter Pest Name
  console.log("\n--- Step 2: Enter Pest ---");
  session = await send("Bollworm");
  if (session?.currentStep === "count" && (session.dataCollected as any).pest_name === "Bollworm") {
      console.log("✅ Pest saved. Bot is at 'count' step.");
  } else {
       console.error("❌ Failed at pest step.", session);
  }

  // Step 3: Enter Count
  console.log("\n--- Step 3: Enter Count ---");
  session = await send("50");
  if (session?.currentStep === "photo" && (session.dataCollected as any).count === 50) {
      console.log("✅ Count saved. Bot is at 'photo' step.");
  } else {
      console.error("❌ Failed at count step.", session);
  }

  // Step 4: Skip Photo (Testing "NEXT")
  console.log("\n--- Step 4: Skip Photo (Testing 'NEXT') ---");
  session = await send("NEXT");
  if (session?.currentStep === "location") {
      console.log("✅ Photo skipped. Bot is at 'location' step.");
  } else {
      console.error("❌ Failed at photo step.", session);
  }

  // Step 5: Send Location
  console.log("\n--- Step 5: Send Location ---");
  // Simulate location msg
  await handleIncomingMessage({ 
      From: `whatsapp:${phone}`, 
      Latitude: "-18.5", 
      Longitude: "29.2" 
  });

  // Verify Report
  const report = await db.query.reports.findFirst({
      orderBy: (reports, { desc }) => [desc(reports.id)], // Get latest
      where: eq(reports.userId, testUser.id)
  });

  if (report && (report.dataPayload as any).pest_name === "Bollworm") {
      console.log("✅ Report generated successfully!", report.id);
      console.log("Payload:", report.dataPayload);
  } else {
      console.error("❌ Report verification failed.", report);
  }

  process.exit(0);
}

verifyRefinedMPBC();
