import { db } from "~/server/db";
import { botSessions, appUsers, reports, organizations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import twilio from "twilio";
import { WorkflowProcessor } from "./workflow-processor";
import { type WorkflowConfig } from "./workflow-types";

// Initialize Twilio Client
const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

type IncomingMessage = {
  From: string;
  Body?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  Latitude?: string;
  Longitude?: string;
};

export async function handleIncomingMessage(msg: IncomingMessage) {
  const senderId = msg.From; // e.g. "whatsapp:+1234..."
  const phoneNumber = senderId.replace("whatsapp:", ""); // "+1234..."

  // 1. Identify User and Org
  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneNumber),
    with: {
      organization: true,
    },
  });

  if (!user || !user.isActive) {
    console.log(`⛔ Access denied for ${phoneNumber}`);
    await sendText(phoneNumber, "Welcome to AgriData AI. This is a closed beta system.\n\nPlease contact admin@agridata.ai to request access.");
    return;
  }

  const org = user.organization;
  if (!org) {
    await sendText(phoneNumber, "Your account is not associated with an organization. Please contact support.");
    return;
  }

  // 2. Handle Commands
  const text = msg.Body?.trim().toUpperCase();
  if (text === "RESET") {
    await db.update(botSessions)
      .set({ 
        currentStep: null, 
        dataCollected: null, 
        status: "RESET",
        workflowId: null 
      })
      .where(eq(botSessions.userId, user.id));
    await sendText(phoneNumber, "Conversation reset. What can I help you with today?");
    return;
  }

  // 3. Get or Create Session
  let session = await db.query.botSessions.findFirst({
    where: eq(botSessions.userId, user.id),
  });

  if (!session) {
    const [newSession] = await db
      .insert(botSessions)
      .values({ userId: user.id, status: "ACTIVE" })
      .returning();
    session = newSession;
  }
  
  if (!session) throw new Error("Failed to create session");

  // 4. Determine Workflow
  const workflowConfig = org.workflowConfig as WorkflowConfig | null;
  const workflowId = org.activeWorkflow;

  if (!workflowId || !workflowConfig) {
      await sendText(phoneNumber, "No active data collection workflow assigned to your organization.");
      return;
  }

  // 5. Initialize Processor
  const processor = new WorkflowProcessor(workflowConfig, user.id, org.id);

  try {
    const result = await processor.processMessage(session, msg);
    await sendText(phoneNumber, result.message);
  } catch (error) {
    console.error("Error in workflow processor:", error);
    await sendText(phoneNumber, "An error occurred during data collection. Please try typing 'RESET' to start over.");
  }
}

async function sendText(to: string, body: string) {
  console.log(`📤 Message to ${to}: ${body}`);
  // Ensure we have the whatsapp: prefix
  const destination = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  
  try {
    await client.messages.create({
      from: `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
      to: destination,
      body,
    });
  } catch (e) {
    console.error("❌ Twilio Error:", e);
  }
}
