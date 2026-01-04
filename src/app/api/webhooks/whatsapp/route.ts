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
    const url = env.NEXT_PUBLIC_APP_URL + "/api/webhooks/whatsapp";
    
    if (!signature) {
      console.error("❌ Missing Twilio signature header");
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    if (!validateTwilioSignature(env.TWILIO_AUTH_TOKEN, signature, url, text)) {
      console.error("❌ Invalid Twilio signature");
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    console.log("✅ Twilio signature validated");

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
