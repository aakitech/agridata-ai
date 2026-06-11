import { db } from "~/server/db";
import {
  botSessions,
  appUsers,
  organizations,
  pestConfigurations,
} from "~/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { env } from "~/env";
import twilio from "twilio";
import { WorkflowProcessor } from "./workflow-processor";
import { type WorkflowConfig } from "./workflow-types";
import { MpbcPestConfigProcessor } from "./mpbc-pest-config-processor";

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
  const phoneNumber = senderId.replace("whatsapp:", "").trim(); // "+1234..." (trimmed)

  // 1. Identify User and Org (try exact match first, then trimmed match for existing data)
  let user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneNumber),
    with: {
      organization: true,
    },
  });

  // If not found, try finding by trimmed comparison (handles existing data with whitespace)
  if (!user) {
    const result = await db.execute(sql`
      SELECT id FROM agridata_app_users 
      WHERE TRIM(phone_number) = ${phoneNumber}
      LIMIT 1
    `);
    
    if (result.length > 0 && result[0]?.id) {
      user = await db.query.appUsers.findFirst({
        where: eq(appUsers.id, result[0].id as string),
        with: { organization: true },
      });
      if (user) {
        console.log(`🔍 Found user by trimmed comparison. DB had: "${user.phoneNumber}"`);
      }
    }
  }

  if (!user) {
    console.log(`⛔ Access denied for ${phoneNumber} - User not found in database`);
    await sendText(phoneNumber, "Welcome to AgriData AI. This is a closed beta system.\n\nPlease contact admin@agridata.ai to request access.");
    return;
  }

  if (!user.isActive) {
    console.log(`⛔ Access denied for ${phoneNumber} - User found but isActive=false`);
    console.log(`   User ID: ${user.id}, Name: ${user.fullName || "N/A"}, Phone in DB: ${user.phoneNumber}`);
    await sendText(phoneNumber, "Welcome to AgriData AI. This is a closed beta system.\n\nPlease contact admin@agridata.ai to request access.");
    return;
  }

  const org = user.organization;
  if (!org) {
    await sendText(phoneNumber, "Your account is not associated with an organization. Please contact support.");
    return;
  }

  // 2. Get Existing Session
  let session = await db.query.botSessions.findFirst({
    where: eq(botSessions.userId, user.id),
  });

  // 3. Handle Commands
  const text = msg.Body?.trim().toUpperCase();
  if (text === "RESET" || text === "CANCEL") {
    const hasActiveSession = Boolean(session?.currentStep);

    if (hasActiveSession) {
      await resetSession(user.id);
      const message =
        text === "CANCEL"
          ? "Current report cancelled. Nothing was submitted. Send any message when you're ready to begin again."
          : "Conversation reset. Nothing was submitted. Send any message when you're ready to begin again.";
      await sendText(phoneNumber, message);
      return;
    }

    const inactiveMessage =
      text === "CANCEL"
        ? "There is no active report to cancel."
        : "There is no active report to reset.";
    await sendText(phoneNumber, inactiveMessage);
    return;
  }

  if (!session) {
    const [newSession] = await db
      .insert(botSessions)
      .values({ userId: user.id, status: "ACTIVE", currentState: "IDLE" })
      .returning();
    session = newSession;
  }
  
  if (!session) throw new Error("Failed to create session");

  const hasActivePestConfigs = await db.query.pestConfigurations.findFirst({
    where: and(
      eq(pestConfigurations.orgId, org.id),
      eq(pestConfigurations.active, true)
    ),
  });

  // 4. Determine Workflow
  const workflowConfig = org.workflowConfig as WorkflowConfig | null;
  const workflowId = org.activeWorkflow;

  // 5. Initialize Processor
  // Use Name if available, otherwise fallback to phone number
  const officerName = user.fullName || phoneNumber;
  const processor = hasActivePestConfigs
    ? new MpbcPestConfigProcessor(user.id, org.id, officerName, org.name, org.slug)
    : workflowId && workflowConfig
      ? new WorkflowProcessor(workflowConfig, user.id, org.id, officerName)
      : null;

  if (!processor) {
    await sendText(
      phoneNumber,
      "No active data collection workflow assigned to your organization."
    );
    return;
  }

  try {
    const isStartingFlow = !session.currentStep;
    const result = await processor.processMessage(session, msg);
    const message = isStartingFlow
      ? addSessionCommandHint(result.message)
      : result.message;
    
    // Check if we need to send an interactive message
    const currentStep = result.currentStep;
    
    if (currentStep?.listOptions && currentStep.listOptions.length > 0) {
      // Send list message
      await sendListMessage(
        phoneNumber,
        message,
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
        message,
        currentStep.quickReplies
      );
    } else {
      // Send regular text message
      await sendText(phoneNumber, message);
    }
  } catch (error) {
    console.error("Error in workflow processor:", error);
    await sendText(phoneNumber, "An error occurred during data collection. Please try typing 'cancel' to stop or 'RESET' to start over.");
  }
}

async function resetSession(userId: string) {
  await db.update(botSessions)
    .set({
      currentStep: null,
      dataCollected: null,
      status: "RESET",
      workflowId: null,
    })
    .where(eq(botSessions.userId, userId));
}

function addSessionCommandHint(message: string) {
  return `${message}\n\nReply cancel anytime to stop this report.`;
}

function formatWhatsAppAddress(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

async function sendText(to: string, body: string) {
  console.log(`📤 Message to ${to}: ${body}`);
  // Ensure we have the whatsapp: prefix
  const destination = formatWhatsAppAddress(to);
  const sender = formatWhatsAppAddress(env.TWILIO_PHONE_NUMBER);
  
  try {
    await client.messages.create({
      from: sender,
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
