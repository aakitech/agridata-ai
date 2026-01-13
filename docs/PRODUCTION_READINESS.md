# AgriData AI - Production Readiness Plan

This document outlines the steps required to move from the development/sandbox environment to the production environment.

## 1. WhatsApp Production Transition

Your WhatsApp number `+263713618310` is now approved and "Online" in the Twilio Console.

### Steps:

1.  **Update Environment Variables**:
    - Change `TWILIO_PHONE_NUMBER` to `whatsapp:+263713618310`.
2.  **Configure Twilio Webhook**:
    - In the Twilio Console, go to the **WhatsApp Senders** section.
    - Click **Edit Sender** for `+263713618310`.
    - Set the **Webhook URL** for "A MESSAGE COMES IN" to: `https://your-production-domain.com/api/webhooks/whatsapp`.
    - Ensure the method is **HTTP POST**.
    - **Note:** The webhook route automatically uses the actual request URL for signature validation, so the URL must match exactly what you configure in Twilio.
3.  **Update App URL**:
    - Ensure `NEXT_PUBLIC_APP_URL` is set to your production domain (e.g., `https://agridata.ai`). This is required for other parts of the application (e.g., invite links), but webhook signature validation no longer depends on it matching exactly.

## 2. Database Migration

We are moving to a new production database instance.

### Steps:

1.  **Connection String**:
    - Update `DATABASE_URL` in the production environment settings with the new Postgres connection string.
2.  **Push Schema**:
    - From your local machine (pointing to the production DB) or via a CI/CD pipeline, run:
      ```bash
      npm run db:push
      ```
    - _Note: Using `db:push` is faster for the initial prototype setup. For subsequent updates, use `npm run db:migrate`._
3.  **Seed Data**:
    - Populate the workflow engine with required data:
      ```bash
      npm run seed:workflows
      ```
    - Create an initial admin user for the dashboard:
      ```bash
      npm run bootstrap-admin
      ```

## 3. Supabase Storage Configuration

The application requires a Supabase Storage bucket for storing report images and media files.

### Steps:

1. **Create Storage Bucket**:
   - Log into your Supabase Dashboard
   - Navigate to **Storage** → **Buckets**
   - Click **New bucket**
   - Name: `reports` (must match exactly)
   - **Important**: Enable **Public bucket** (this allows images to be accessible via public URLs)
   - Click **Create bucket**

2. **Verify Bucket Settings**:
   - Ensure the bucket is set to **Public**
   - If you need to keep it private, you'll need to implement signed URLs or RLS policies (not recommended for initial setup)

3. **File Upload Path Structure**:
   - Files are stored in the format: `{reportId}/{timestamp}-{random}.{ext}`
   - Example: `3865d268-ad58-4c3a-805a-d4a0843f1929/1234567890-abc123.jpg`

**Note**: Without this bucket configured and set to public, report images will not display in the dashboard.

## 4. Environment Variable Checklist

Ensure the following variables are set in the production hosting provider (e.g., Vercel/Railway):

| Variable                        | Description                                          |
| :------------------------------ | :--------------------------------------------------- |
| `NODE_ENV`                      | Must be `production`                                 |
| `DATABASE_URL`                  | Production Postgres URI                              |
| `NEXT_PUBLIC_APP_URL`           | Your production domain (e.g., `https://agridata.ai`) |
| `TWILIO_ACCOUNT_SID`            | Your Twilio Account SID                              |
| `TWILIO_AUTH_TOKEN`             | Your Twilio Auth Token                               |
| `TWILIO_PHONE_NUMBER`           | `whatsapp:+263713618310`                             |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production Supabase project URL                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase Anon Key                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Production Supabase Service Role Key                 |

## 5. Final Verification

Before handing over for the demo, perform these tests:

1.  **Webhook Test**: Send a WhatsApp message to `+263713618310`. Check the server logs for `🔔 Webhook received!`.
2.  **Signature Check**: If you get a `401 Unauthorized` on the webhook, verify that `NEXT_PUBLIC_APP_URL` is set correctly and includes `https://`.
3.  **Dashboard Check**: Log into the dashboard and ensure the stats and map are loading.
4.  **Image Display Check**: 
    - Navigate to the Triage page
    - Select a report that has images
    - Verify that images are displaying correctly in the "Evidence" section
    - If images are not showing, verify the `reports` bucket exists and is set to public in Supabase Storage
5.  **Workflow Check**: Complete a full reporting flow via WhatsApp and ensure the record appears in the Triage section of the dashboard.

## 6. Local Development & Testing

For instructions on how to set up a local development environment with Twilio Sandbox and ngrok for future maintenance, refer to:
`src/server/modules/whatsapp-bot/README.md`
