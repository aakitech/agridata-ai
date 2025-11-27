import { db } from "~/server/db";
import { botSessions, botUsers, reports } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import twilio from "twilio";

// Initialize Twilio Client
// Note: In a real app, ensure these are set. For now, we assume they are.
const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

type IncomingMessage = {
  From: string;
  Body?: string;
  MediaUrl0?: string;
  Latitude?: string;
  Longitude?: string;
};

type BotState = "IDLE" | "AWAITING_MENU_CHOICE" | "AWAITING_PHOTO" | "AWAITING_LOCATION" | "AWAITING_DESCRIPTION";

export async function handleIncomingMessage(msg: IncomingMessage) {
  const phoneNumber = msg.From;

  // 1. Get or Create User
  let user = await db.query.botUsers.findFirst({
    where: eq(botUsers.phoneNumber, phoneNumber),
  });

  if (!user) {
    const [newUser] = await db
      .insert(botUsers)
      .values({ phoneNumber })
      .returning();
    user = newUser;
  }

  if (!user) throw new Error("Failed to create user");

  // 2. Get or Create Session
  let session = await db.query.botSessions.findFirst({
    where: eq(botSessions.userId, user.id),
  });

  if (!session) {
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
      case "AWAITING_MENU_CHOICE":
        await handleMenuChoice(user.id, msg);
        break;
      case "AWAITING_PHOTO":
        await handlePhoto(user.id, session, msg);
        break;
      case "AWAITING_LOCATION":
        await handleLocation(user.id, session, msg);
        break;
      case "AWAITING_DESCRIPTION":
        await handleDescription(user.id, session, msg);
        break;
      default:
        // Reset if unknown state
        await sendText(phoneNumber, "Something went wrong. Resetting...");
        await updateState(user.id, "IDLE");
    }
  } catch (error) {
    console.error("Error in state machine:", error);
    await sendText(phoneNumber, "An error occurred. Please try again.");
  }
}

// --- Helpers ---

async function sendText(to: string, body: string) {
  try {
    await client.messages.create({
      from: env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });
  } catch (e) {
    console.error("Twilio Error:", e);
  }
}

async function updateState(userId: string, state: BotState, draftReportId?: string) {
  await db.update(botSessions)
    .set({ 
        currentState: state, 
        lastActive: new Date(),
        draftReportId: draftReportId ?? undefined
    })
    .where(eq(botSessions.userId, userId));
}

// --- Handlers ---

async function handleIdle(userId: string, msg: IncomingMessage) {
  // Any message triggers the menu
  await sendText(msg.From, "Welcome to AgriData AI! 🌱\n\nHow can I help you today?\n1. Report Pest/Disease 🐛\n2. Check Weather 🌤️\n\n(Reply with 1 or 2)");
  await updateState(userId, "AWAITING_MENU_CHOICE");
}

async function handleMenuChoice(userId: string, msg: IncomingMessage) {
  const choice = msg.Body?.trim();

  if (choice === "1" || choice?.toLowerCase().includes("report")) {
    // Create Draft Report
    const [report] = await db.insert(reports)
        .values({ userId, status: "DRAFT" })
        .returning();
    
    if (!report) throw new Error("Failed to create report");

    await sendText(msg.From, "Please send a photo of the pest or disease. 📸");
    await updateState(userId, "AWAITING_PHOTO", report.id);
  } else if (choice === "2" || choice?.toLowerCase().includes("weather")) {
    await sendText(msg.From, "Weather feature is coming soon! 🚧");
    // Stay in IDLE or go back to IDLE
    await updateState(userId, "IDLE");
  } else {
    await sendText(msg.From, "I didn't understand that. Please reply with 1 or 2.");
  }
}

async function handlePhoto(userId: string, session: any, msg: IncomingMessage) {
  if (!msg.MediaUrl0) {
    await sendText(msg.From, "Please send a photo, not text. 📸");
    return;
  }

  // Save Media URL to Report
  // In a real app, we would download and upload to Supabase Storage here.
  // For MVP, we'll just save the Twilio URL (note: it expires eventually).
  const reportId = session.draftReportId;
  if (!reportId) {
      await sendText(msg.From, "Session error. Restarting.");
      await updateState(userId, "IDLE");
      return;
  }

  await db.update(reports)
    .set({ mediaUrl: msg.MediaUrl0 })
    .where(eq(reports.id, reportId));

  await sendText(msg.From, "Got the photo! Now, please share your location. 📍\n(Tap the attachment icon -> Location)");
  await updateState(userId, "AWAITING_LOCATION", reportId);
}

async function handleLocation(userId: string, session: any, msg: IncomingMessage) {
  const reportId = session.draftReportId;
    if (!reportId) {
      await sendText(msg.From, "Session error. Restarting.");
      await updateState(userId, "IDLE");
      return;
  }

  if (msg.Latitude && msg.Longitude) {
    const locationStr = `POINT(${msg.Longitude} ${msg.Latitude})`;
    await db.update(reports)
        .set({ location: locationStr })
        .where(eq(reports.id, reportId));
    
    await sendText(msg.From, "Location received! Finally, please describe what you see (or send a voice note). 🎙️");
    await updateState(userId, "AWAITING_DESCRIPTION", reportId);
  } else {
    await sendText(msg.From, "Please share your location using the attachment menu. 📍");
  }
}

async function handleDescription(userId: string, session: any, msg: IncomingMessage) {
    const reportId = session.draftReportId;
    if (!reportId) {
      await sendText(msg.From, "Session error. Restarting.");
      await updateState(userId, "IDLE");
      return;
  }

  const description = msg.Body || "Voice Note (Processing Pending)"; // Handle voice later

  await db.update(reports)
    .set({ 
        description,
        status: "PENDING_TRIAGE"
    })
    .where(eq(reports.id, reportId));

  await sendText(msg.From, `Report #${reportId.slice(0, 8)} received! Thank you for helping us protect our crops. 🌱`);
  await updateState(userId, "IDLE");
}
