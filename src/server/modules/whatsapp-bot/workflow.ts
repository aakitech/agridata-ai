import { db } from "~/server/db";
import { botSessions, appUsers, reports, reportMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import twilio from "twilio";
import { MediaService } from "~/server/modules/media/media-service";

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

type BotState = "IDLE" | "AWAITING_LABEL" | "AWAITING_PHOTO_COUNT" | "AWAITING_LOCATION";

export async function handleIncomingMessage(msg: IncomingMessage) {
  const phoneNumber = msg.From;

  // 1. Whitelist Check (Middleware)
  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneNumber),
  });

  if (!user || !user.isActive) {
    console.log(`⛔ Access denied for ${phoneNumber}`);
    await sendText(phoneNumber, "Welcome to AgriData AI. This is a closed beta system.\n\nPlease contact admin@agridata.ai to request access.");
    return;
  }

  // 2. Get or Create Session
  let session = await db.query.botSessions.findFirst({
    where: eq(botSessions.userId, user.id),
  });

  if (!session) {
    // Check if session creation works with foreign key constraint (user must exist, which we confirmed)
    const [newSession] = await db
      .insert(botSessions)
      .values({ userId: user.id, currentState: "IDLE" })
      .returning();
    session = newSession;
  }
  
  if (!session) throw new Error("Failed to create session");

  // 3. State Machine
  const state = session.currentState as BotState;

  try {
    switch (state) {
      case "IDLE":
        await handleIdle(user.id, msg);
        break;
      case "AWAITING_LABEL":
        await handleLabel(user.id, session, msg);
        break;
      case "AWAITING_PHOTO_COUNT":
        await handlePhotoCount(user.id, session, msg);
        break;
      case "AWAITING_LOCATION":
        await handleLocation(user.id, session, msg);
        break;
      default:
        // Reset if unknown state
        await sendText(phoneNumber, "System update. Resetting conversation...");
        await updateState(user.id, "IDLE");
    }
  } catch (error) {
    console.error("Error in state machine:", error);
    await sendText(phoneNumber, "An error occurred. Please try again.");
    await updateState(user.id, "IDLE");
  }
}

// --- Helpers ---

async function sendText(to: string, body: string) {
  console.log(`📤 Message to ${to}: ${body}`);
  try {
    await client.messages.create({
      from: `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
      to,
      body,
    });
  } catch (e) {
    console.error("❌ Twilio Error:", e);
  }
}

async function updateState(userId: string, state: BotState, draftReportId?: string) {
  await db.update(botSessions)
    .set({ 
        currentState: state, 
        lastActive: new Date(),
        draftReportId: draftReportId ?? undefined // Set to null if undefined is passed? No, keep it if not strictly cleared.
        // Actually, if we pass undefined, Drizzle ignores it?
        // We should pass null if we want to clear it.
        // For now, only update if provided or explicitly null.
    })
    .where(eq(botSessions.userId, userId));
    
    // Explicit update for draftReportId if needed would be better.
    if (draftReportId !== undefined) {
         await db.update(botSessions)
            .set({ draftReportId: draftReportId })
            .where(eq(botSessions.userId, userId));
    }
}

// --- Handlers ---

async function handleIdle(userId: string, msg: IncomingMessage) {
  // Trigger: Expecting Image or "Hi"
  
  if (msg.MediaUrl0) {
    // User sent an image immediately. Start flow.
    await startReportFlow(userId, msg);
  } else {
    // User sent text.
    await sendText(
      msg.From, 
      "Hello! 👋\n\nI am ready to collect data. Please **send a photo** of what you are observing."
    );
    // Stay IDLE.
  }
}

async function startReportFlow(userId: string, msg: IncomingMessage) {
    // 1. Create Report
    const [report] = await db.insert(reports)
        .values({ 
            userId, 
            orgId: (await db.query.appUsers.findFirst({ where: eq(appUsers.id, userId) }))!.orgId, // Fetch orgId
            status: "DRAFT" 
        })
        .returning();
    
    if (!report) throw new Error("Failed to create report");

    // 2. Handle Image
    await processImage(report.id, msg);

    // 3. Ask for Label
    await sendText(msg.From, "📸 Photo received!\n\n**What is this?**\n(e.g., Fall Armyworm, Desert Locust)");
    await updateState(userId, "AWAITING_LABEL", report.id);
}

async function processImage(reportId: string, msg: IncomingMessage) {
    if (!msg.MediaUrl0) return;

    const mediaService = new MediaService();
    // Default to image/jpeg if not provided
    const contentType = msg.MediaContentType0 || "image/jpeg";
    
    let mediaUrl = msg.MediaUrl0;

    try {
        // Upload to Supabase
        mediaUrl = await mediaService.uploadFromTwilio(msg.MediaUrl0, reportId, contentType);
    } catch (error) {
        console.error("Upload failed, using Twilio URL fallback", error);
    }

    // Save Media Record
    await mediaService.saveMediaRecord(reportId, mediaUrl, contentType);
    
    // Also update main report media_url for thumbnail/convenience
    await db.update(reports).set({ mediaUrl }).where(eq(reports.id, reportId));
}

async function handleLabel(userId: string, session: any, msg: IncomingMessage) {
    const reportId = session.draftReportId;
    if (!reportId) return reset(userId, msg.From);

    if (msg.Body) {
        // Save Label
        await db.update(reports)
            .set({ label: msg.Body })
            .where(eq(reports.id, reportId));
        
        // Ask for Count
        await sendText(msg.From, "Got it. **How many?**\n(Reply with a number or type 'SKIP')");
        await updateState(userId, "AWAITING_PHOTO_COUNT", reportId);
    } else {
        await sendText(msg.From, "Please type the name of the pest or object.");
    }
}

async function handlePhotoCount(userId: string, session: any, msg: IncomingMessage) {
    const reportId = session.draftReportId;
    if (!reportId) return reset(userId, msg.From);

    const text = msg.Body?.trim().toUpperCase();
    
    if (text && text !== "SKIP") {
        await db.update(reports)
            .set({ quantity: text })
            .where(eq(reports.id, reportId));
    }

    // Ask for Location
    await sendText(
        msg.From, 
        "Almost done! Please share your **Location**. 📍\n(Tap 📎 -> Location -> Send Current Location)"
    );
    await updateState(userId, "AWAITING_LOCATION", reportId);
}

async function handleLocation(userId: string, session: any, msg: IncomingMessage) {
    const reportId = session.draftReportId;
    if (!reportId) return reset(userId, msg.From);

    if (msg.Latitude && msg.Longitude) {
        const locationStr = `POINT(${msg.Longitude} ${msg.Latitude})`;
        
        await db.update(reports)
            .set({ 
                location: locationStr, 
                status: "PENDING_TRIAGE" // Mark as ready
            })
            .where(eq(reports.id, reportId));
        
        await sendText(msg.From, "✅ **Report Saved!**\n\nThank you for your observation. You can send another photo anytime.");
        await updateState(userId, "IDLE"); // Clear draftReportId implicitly or explicitly? 
        // We should clear draftReportId.
        await db.update(botSessions).set({ draftReportId: null }).where(eq(botSessions.userId, userId));

    } else {
        await sendText(msg.From, "Please send a Location attachment. 📍");
    }
}

async function reset(userId: string, phone: string) {
    await sendText(phone, "Session expired or invalid. Let's start over.");
    await updateState(userId, "IDLE");
    await db.update(botSessions).set({ draftReportId: null }).where(eq(botSessions.userId, userId));
}
