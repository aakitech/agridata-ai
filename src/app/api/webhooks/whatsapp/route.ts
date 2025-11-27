import { type NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "~/server/whatsapp/workflow";

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

    // 2. Validate Twilio Signature (Optional for local dev, critical for prod)
    // In a real app, you'd check the X-Twilio-Signature header
    // const signature = req.headers.get("x-twilio-signature");
    // const url = env.AppUrl + "/api/webhooks/whatsapp";
    // if (!validateRequest(env.TWILIO_AUTH_TOKEN, signature || "", url, body)) {
    //   return new NextResponse("Unauthorized", { status: 401 });
    // }

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
