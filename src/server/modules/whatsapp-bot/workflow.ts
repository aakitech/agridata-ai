import { db } from "~/server/db";
import { botSessions, botUsers, reports, reportMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import twilio from "twilio";
import { MediaService } from "~/server/modules/media/media-service";

// Initialize Twilio Client
// Note: In a real app, ensure these are set. For now, we assume they are.
const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

type IncomingMessage = {
  From: string;
  Body?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
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
  console.log(`📤 Attempting to send message to ${to}:`, body);
  console.log(`📱 Using Twilio number: ${env.TWILIO_PHONE_NUMBER}`);
  
  try {
    const result = await client.messages.create({
      from: `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
      to,
      body,
    });
    console.log(`✅ Message sent successfully! SID: ${result.sid}`);
  } catch (e) {
    console.error("❌ Twilio Error:", e);
  }
}

async function handleWeatherCheck(to: string, latitude: string, longitude: string) {
  try {
    // Call Open-Meteo API
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&timezone=auto`
    );
    
    const data = await response.json() as any;
    const temp = Math.round(data.current.temperature_2m);
    const humidity = data.current.relative_humidity_2m;
    
    // Simple risk assessment
    let riskLevel = "Low";
    let riskMessage = "Conditions look good.";
    
    if (temp > 28 && humidity < 60) {
      riskLevel = "⚠️ High";
      riskMessage = "Hot and dry conditions favor Aphids and Spider Mites. Scout your fields!";
    } else if (temp > 25 && humidity > 80) {
      riskLevel = "⚠️ Moderate";
      riskMessage = "Warm and humid conditions may promote fungal diseases. Monitor closely.";
    }
    
    await sendText(
      to,
      `📍 *Weather Update*\n\n🌡️ Temperature: ${temp}°C\n💧 Humidity: ${humidity}%\n\n${riskLevel}: ${riskMessage}\n\nStay vigilant! 🌱`
    );
  } catch (error) {
    console.error("Weather API error:", error);
    await sendText(to, "Sorry, I couldn't fetch the weather data right now. Please try again later.");
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
  // Send greeting with menu options in a single message
  await sendText(
    msg.From, 
    "Mhoro! I am your crop protection assistant. 🌱\n\nHow can I help you today?\n\n1️⃣ Report Crop Problem\n2️⃣ Check Local Risk\n\nReply with 1 or 2"
  );
  await updateState(userId, "AWAITING_MENU_CHOICE");
}

async function handleMenuChoice(userId: string, msg: IncomingMessage) {
  const choice = msg.Body?.trim();

  if (choice === "1" || choice?.toLowerCase().includes("report") || choice?.toLowerCase().includes("problem")) {
    // Create Draft Report
    const [report] = await db.insert(reports)
        .values({ userId, status: "DRAFT" })
        .returning();
    
    if (!report) throw new Error("Failed to create report");

    await sendText(
      msg.From, 
      "📸 *Photos Required*\n\nPlease send clear photos of the damaged plant.\n\n✅ Best results:\n• Close-up of affected leaves or stems\n• Good lighting\n• Focus on the damage\n\nTap the 📎 icon to attach a photo.\n\n(You can send multiple photos. Type *DONE* when finished.)"
    );
    await updateState(userId, "AWAITING_PHOTO", report.id);
  } else if (choice === "2" || choice?.toLowerCase().includes("risk") || choice?.toLowerCase().includes("weather")) {
    // Set intent for weather check
    await db.update(botSessions)
      .set({ 
        metadata: { intent: "WEATHER" },
        lastActive: new Date()
      })
      .where(eq(botSessions.userId, userId));
    
    await sendText(
      msg.From,
      "📍 *Location Required*\n\nTo check the risk in your area, I need your location.\n\nTap the 📎 (Paperclip) icon → Location → 'Send Your Current Location'"
    );
    await updateState(userId, "AWAITING_LOCATION");
  } else {
    await sendText(msg.From, "I didn't understand that. Please reply with:\n\n1️⃣ for Report Crop Problem\n2️⃣ for Check Local Risk");
  }
}



// ...

async function handlePhoto(userId: string, session: any, msg: IncomingMessage) {
  const reportId = session.draftReportId;
  if (!reportId) {
    await sendText(msg.From, "Session error. Restarting.");
    await updateState(userId, "IDLE");
    return;
  }

  // Check for "DONE" command
  if (msg.Body?.trim().toUpperCase() === "DONE") {
    await sendText(msg.From, "Great! Now, please share your location. 📍\n(Tap the attachment icon -> Location)");
    await updateState(userId, "AWAITING_LOCATION", reportId);
    return;
  }

  if (!msg.MediaUrl0) {
    await sendText(msg.From, "Please send a photo or type 'DONE' if you are finished. 📸");
    return;
  }

  // Upload to Supabase Storage (with fallback)
  const mediaService = new MediaService();
  const contentType = msg.MediaContentType0 || "image/jpeg";
  let mediaUrl = msg.MediaUrl0;

  try {
    // Attempt to upload to Supabase
    mediaUrl = await mediaService.uploadFromTwilio(msg.MediaUrl0, reportId, contentType);
    console.log(`✅ Uploaded to Supabase: ${mediaUrl}`);
  } catch (error) {
    console.error("⚠️ Failed to upload to Supabase, falling back to Twilio URL:", error);
    // Fallback: mediaUrl remains as msg.MediaUrl0
  }

  // Save Media Record
  await mediaService.saveMediaRecord(reportId, mediaUrl, contentType);

  // Count photos
  const mediaCount = await db.$count(reportMedia, eq(reportMedia.reportId, reportId));

  await sendText(
    msg.From, 
    `✅ Photo received! (Total: ${mediaCount})\n\nSend another photo or type *DONE* to finish.`
  );
  // Stay in AWAITING_PHOTO state
}

async function handleLocation(userId: string, session: any, msg: IncomingMessage) {
  if (msg.Latitude && msg.Longitude) {
    const locationStr = `POINT(${msg.Longitude} ${msg.Latitude})`;
    
    // Check if this is for weather or reporting
    const sessionData = await db.query.botSessions.findFirst({
      where: eq(botSessions.userId, userId),
    });
    
    const intent = (sessionData?.metadata as any)?.intent;
    
    if (intent === "WEATHER") {
      // Weather check flow
      await handleWeatherCheck(msg.From, msg.Latitude, msg.Longitude);
      
      // Clear metadata and return to IDLE
      await db.update(botSessions)
        .set({ metadata: null, lastActive: new Date() })
        .where(eq(botSessions.userId, userId));
      
      await updateState(userId, "IDLE");
    } else {
      // Report flow
      const reportId = session.draftReportId;
      if (!reportId) {
        await sendText(msg.From, "Session error. Restarting.");
        await updateState(userId, "IDLE");
        return;
      }
      
      await db.update(reports)
        .set({ location: locationStr })
        .where(eq(reports.id, reportId));
      
      await sendText(
        msg.From, 
        "📍 Location received!\n\nFinally, please describe what you see.\n\n💬 Please type a message describing the symptoms, when you noticed them, and how widespread the problem is."
      );
      await updateState(userId, "AWAITING_DESCRIPTION", reportId);
    }
  } else {
    await sendText(msg.From, "Please share your location using the attachment menu. 📍\n\nTap 📎 → Location → 'Send Your Current Location'");
  }
}

async function handleDescription(userId: string, session: any, msg: IncomingMessage) {
  const reportId = session.draftReportId;
  if (!reportId) {
    await sendText(msg.From, "Session error. Restarting.");
    await updateState(userId, "IDLE");
    return;
  }

  if (msg.Body) {
    // Save text description
    await db.update(reports)
      .set({ 
        description: msg.Body,
        status: "PENDING_TRIAGE"
      })
      .where(eq(reports.id, reportId));
    
    await sendText(msg.From, `✅ Report #${reportId.slice(0, 8)} received!\n\nThank you for helping us protect our crops. 🌱\n\nWe'll notify you if an alert is issued in your area.`);
  } else {
    await sendText(msg.From, "Please send a text description describing the problem.");
    return;
  }
  
  await updateState(userId, "IDLE");
}
