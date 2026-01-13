import { type NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "~/server/modules/whatsapp-bot/workflow";
import { env } from "~/env";
import crypto from 'crypto';

/**
 * Validates Twilio webhook signature to ensure request is from Twilio
 */
function validateTwilioSignature(token: string, signature: string, url: string, body: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha1', token)
    .update(url + body)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  console.log("🔔 Webhook received!");
  
  try {
    // 1. Get the raw body and headers
    const text = await req.text();
    console.log("📦 Raw body:", text);
    
    const params = new URLSearchParams(text);
    const body: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      body[key] = value;
    }
    
    console.log("📋 Parsed body:", JSON.stringify(body, null, 2));

    // 2. Validate Twilio Signature (CRITICAL for production security)
    const signature = req.headers.get("x-twilio-signature");
    
    // Construct the actual URL that Twilio sees from the incoming request
    // This ensures exact match with what Twilio uses to generate the signature
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || req.nextUrl.host;
    const pathname = req.nextUrl.pathname;
    const search = req.nextUrl.search; // Includes query parameters if any
    const url = `${protocol}://${host}${pathname}${search}`;
    
    // Debug logging for signature validation
    console.log("🔍 Signature validation debug:");
    console.log("  - Protocol:", protocol);
    console.log("  - Host:", host);
    console.log("  - Pathname:", pathname);
    console.log("  - Search params:", search || "(none)");
    console.log("  - Constructed URL:", url);
    console.log("  - NEXT_PUBLIC_APP_URL (for reference):", env.NEXT_PUBLIC_APP_URL);
    console.log("  - Signature header present:", !!signature);
    console.log("  - Signature header (masked):", signature ? `${signature.substring(0, 8)}...` : "missing");
    console.log("  - Auth token present:", !!env.TWILIO_AUTH_TOKEN);
    
    // In development (e.g. ngrok), the URL might not match what Twilio sees.
    // We skip validation in dev to make testing easier.
    if (env.NODE_ENV === "development") {
      console.log("⚠️ Skipping Twilio signature validation in development");
    } else {
      if (!signature) {
        console.error("❌ Missing Twilio signature header");
        console.error("   Request headers:", Object.fromEntries(req.headers.entries()));
        return new NextResponse("Unauthorized", { status: 401 });
      }
      
      if (!env.TWILIO_AUTH_TOKEN) {
        console.error("❌ Missing TWILIO_AUTH_TOKEN environment variable");
        return new NextResponse("Internal Server Error", { status: 500 });
      }
      
      if (!validateTwilioSignature(env.TWILIO_AUTH_TOKEN, signature, url, text)) {
        console.error("❌ Invalid Twilio signature");
        console.error("   Validation details:");
        console.error("   - URL used:", url);
        console.error("   - Signature received:", `${signature.substring(0, 8)}...`);
        console.error("   - Body length:", text.length);
        console.error("   - Ensure Twilio webhook URL matches exactly:", url);
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }
    
    console.log("✅ Twilio request accepted");

    // 3. Process the message
    // Twilio sends form-urlencoded data
    const incomingMsg = {
      From: body.From ?? "",
      Body: body.Body,
      MediaUrl0: body.MediaUrl0,
      Latitude: body.Latitude,
      Longitude: body.Longitude,
    };

    console.log("📨 Incoming message:", incomingMsg);

    if (!incomingMsg.From) {
        console.error("❌ Missing From field");
        return NextResponse.json({ error: "Invalid request: Missing From" }, { status: 400 });
    }

    console.log("🚀 Calling handleIncomingMessage...");
    await handleIncomingMessage(incomingMsg);
    console.log("✅ handleIncomingMessage completed");

    // 4. Respond with TwiML (or just 200 OK if we send messages via API)
    // Returning 200 OK tells Twilio we got it.
    return new NextResponse("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("💥 Error handling webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
