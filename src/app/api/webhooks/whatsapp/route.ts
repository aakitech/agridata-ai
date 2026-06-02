import { type NextRequest, NextResponse, after } from "next/server";
import { handleIncomingMessage } from "~/server/modules/whatsapp-bot/workflow";
import { env } from "~/env";
import crypto from 'crypto';
import { captureError } from "~/lib/observability/errors";
import { captureWebhookError } from "~/lib/observability/server";

/**
 * Validates Twilio webhook signature to ensure request is from Twilio
 * Based on: https://www.twilio.com/docs/usage/security#validating-requests
 */
function validateTwilioSignature(token: string, signature: string, url: string, params: URLSearchParams): boolean {
  // Twilio's signature algorithm:
  // 1. Start with the full URL
  // 2. Sort parameters alphabetically by key
  // 3. Append each key+value (no separators)
  // 4. Create HMAC-SHA1 hash with auth token
  // 5. Base64 encode
  
  let data = url;
  
  // Sort parameters alphabetically and append to URL
  const sortedKeys = Array.from(params.keys()).sort();
  for (const key of sortedKeys) {
    data += key + params.get(key);
  }
  
  const expectedSignature = crypto
    .createHmac('sha1', token)
    .update(data)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}


export async function POST(req: NextRequest) {
  try {
    // 1. Get the raw body
    const rawBody = Buffer.from(await req.arrayBuffer());
    const text = rawBody.toString("utf8");
    
    if (!text || text.length === 0) {
      console.error("⚠️ Empty body received! This will cause signature validation to fail.");
      console.error("   Headers:", Object.fromEntries(req.headers.entries()));
      console.error("   Raw body bytes:", rawBody.length);
    }
    
    const params = new URLSearchParams(text);
    const body: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      body[key] = value;
    }
    

    // 2. Validate Twilio Signature (CRITICAL for production security)
    const signature = req.headers.get("x-twilio-signature");
    
    // Construct the actual URL that Twilio sees from the incoming request
    // This ensures exact match with what Twilio uses to generate the signature
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl.host;
    const pathname = req.nextUrl.pathname;
    const search = req.nextUrl.search; // Includes query parameters if any
    const url = `${protocol}://${host}${pathname}${search}`;
    
    
    // In development (e.g. ngrok), the URL might not match what Twilio sees.
    // We skip validation in dev to make testing easier.
    // TEMP: Force validation even in dev for testing
    const forceValidation = process.env.FORCE_TWILIO_VALIDATION === "true";
    
    if (env.NODE_ENV === "development" && !forceValidation) {
      console.log("⚠️ Skipping Twilio signature validation in development");
    } else {
      if (!signature) {
        console.error("❌ Missing Twilio signature header");
        console.error("   Request headers:", Object.fromEntries(req.headers.entries()));
        after(captureWebhookError("missing_signature", {
          route: "/api/webhooks/whatsapp",
          feature: "whatsapp-webhook",
        }));
        return new NextResponse("Unauthorized", { status: 401 });
      }
      
      if (!env.TWILIO_AUTH_TOKEN) {
        console.error("❌ Missing TWILIO_AUTH_TOKEN environment variable");
        after(captureWebhookError("missing_twilio_auth_token", {
          route: "/api/webhooks/whatsapp",
          feature: "whatsapp-webhook",
        }));
        return new NextResponse("Internal Server Error", { status: 500 });
      }
      
      if (!validateTwilioSignature(env.TWILIO_AUTH_TOKEN, signature, url, params)) {
        console.error("❌ Invalid Twilio signature");
        console.error("   Validation details:");
        console.error("   - URL used:", url);
        console.error("   - Signature received:", `${signature.substring(0, 8)}...`);
        console.error("   - Body length:", text.length);
        console.error("   - Body content:", text.substring(0, 200));
        console.error("   - Ensure Twilio webhook URL matches exactly:", url);
        after(captureWebhookError("invalid_signature", {
          route: "/api/webhooks/whatsapp",
          feature: "whatsapp-webhook",
        }));
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
        after(captureWebhookError("missing_from", {
          route: "/api/webhooks/whatsapp",
          feature: "whatsapp-webhook",
        }));
        return NextResponse.json({ error: "Invalid request: Missing From" }, { status: 400 });
    }

    await handleIncomingMessage(incomingMsg);

    // 4. Respond with TwiML (or just 200 OK if we send messages via API)
    // Returning 200 OK tells Twilio we got it.
    return new NextResponse("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("💥 Error handling webhook:", error);
    after(captureError(error, {
      route: "/api/webhooks/whatsapp",
      feature: "whatsapp-webhook",
    }));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
