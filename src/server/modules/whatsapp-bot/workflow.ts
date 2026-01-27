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
      .values({ userId: user.id, status: "ACTIVE", currentState: "IDLE" })
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
  // Use Name if available, otherwise fallback to phone number
  const officerName = user.fullName || phoneNumber;
  const processor = new WorkflowProcessor(workflowConfig, user.id, org.id, officerName);

  try {
    const result = await processor.processMessage(session, msg);
    
    // Check if we need to send an interactive message
    const currentStep = result.currentStep;
    
    if (currentStep?.listOptions && currentStep.listOptions.length > 0) {
      // Send list message
      await sendListMessage(
        phoneNumber,
        result.message,
        "Select Option",
        [{
          title: "Options",
          rows: currentStep.listOptions.map(opt => ({
            id: opt.id,
            title: opt.title,
            description: opt.description
          }))
        }]
      );
    } else if (currentStep?.quickReplies && currentStep.quickReplies.length > 0) {
      // Send quick reply buttons
      await sendQuickReply(
        phoneNumber,
        result.message,
        currentStep.quickReplies
      );
    } else {
      // Send regular text message
      await sendText(phoneNumber, result.message);
    }
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

// Send list message (dropdown-style selection)
// NOTE: Only works with approved WhatsApp Business accounts, NOT sandbox
// Fallback to text with numbered options
async function sendListMessage(
  to: string, 
  body: string, 
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
) {
  console.log(`📤 List message to ${to} (using text fallback for sandbox)`);
  
  // Build text-based list with numbers
  let textMessage = body + "\n\n";
  let optionNumber = 1;
  
  for (const section of sections) {
    for (const row of section.rows) {
      textMessage += `${optionNumber}️⃣ ${row.title}`;
      if (row.description) {
        textMessage += ` - ${row.description}`;
      }
      textMessage += "\n";
      optionNumber++;
    }
  }
  
  textMessage += `\nReply with the number to select.`;
  
  await sendText(to, textMessage);
}

// Send message with quick reply buttons
// NOTE: Only works with approved WhatsApp Business accounts, NOT sandbox
// Fallback to text with options
async function sendQuickReply(
  to: string,
  body: string,
  replies: Array<{ id: string; title: string }>
) {
  console.log(`📤 Quick reply message to ${to} (using text fallback for sandbox)`);
  
  // Build text-based options
  let textMessage = body + "\n\n";
  textMessage += replies.map((r, i) => `${i + 1}. ${r.title}`).join("\n");
  textMessage += `\n\nReply with the number to select.`;
  
  await sendText(to, textMessage);
}

export { sendText, sendListMessage, sendQuickReply };
