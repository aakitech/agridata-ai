import { type NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "~/server/whatsapp/workflow";

export async function POST(req: NextRequest) {
  try {
    // 1. Get the raw body and headers
    const text = await req.text();
    const params = new URLSearchParams(text);
    const body: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      body[key] = value;
    }

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

    if (!incomingMsg.From) {
        return NextResponse.json({ error: "Invalid request: Missing From" }, { status: 400 });
    }

    await handleIncomingMessage(incomingMsg);

    // 4. Respond with TwiML (or just 200 OK if we send messages via API)
    // Returning 200 OK tells Twilio we got it.
    return new NextResponse("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
