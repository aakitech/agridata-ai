import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";
import { db } from "~/server/db";
import { reportMedia } from "~/server/db/schema";

export class MediaService {
  private supabase;

  constructor() {
    // Use Service Role Key if available to bypass RLS, otherwise fallback to Anon Key
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    this.supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);
  }

  /**
   * Downloads media from Twilio and uploads it to Supabase Storage.
   * Returns the public URL of the uploaded file.
   */
  async uploadFromTwilio(twilioUrl: string, reportId: string, contentType: string): Promise<string> {
    try {
      console.log(`📥 Downloading from Twilio: ${twilioUrl}`);
      
      // 1. Download from Twilio with Basic Auth
      // Twilio media URLs often require authentication if "Enforce Basic Auth" is on
      const authHeader = 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const response = await fetch(twilioUrl, {
        headers: {
          Authorization: authHeader
        }
      });
      
      if (!response.ok) {
        // Try without auth if first attempt fails (some URLs are public)
        console.log("⚠️ Auth fetch failed, trying public fetch...");
        const publicResponse = await fetch(twilioUrl);
        if (!publicResponse.ok) {
           throw new Error(`Failed to fetch media from Twilio: ${publicResponse.status} ${publicResponse.statusText}`);
        }
        // Use the public response if successful
        const arrayBuffer = await publicResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return this.uploadToSupabase(buffer, reportId, contentType);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return this.uploadToSupabase(buffer, reportId, contentType);

    } catch (error) {
      console.error("❌ Media upload error:", error);
      throw error;
    }
  }

  private async uploadToSupabase(buffer: Buffer, reportId: string, contentType: string): Promise<string> {
      // 2. Generate a unique path
      const ext = this.getExtensionFromContentType(contentType);
      const filename = `${reportId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      console.log(`📤 Uploading to Supabase: ${filename}`);

      // 3. Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from("reports")
        .upload(filename, buffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error("❌ Supabase upload error details:", error);
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      console.log("✅ Upload successful!");

      // 4. Get Public URL
      const { data: publicUrlData } = this.supabase.storage
        .from("reports")
        .getPublicUrl(filename);

      return publicUrlData.publicUrl;
  }

  /**
   * Saves the media record to the database.
   */
  async saveMediaRecord(reportId: string, mediaUrl: string, contentType: string) {
    await db.insert(reportMedia).values({
      reportId,
      mediaUrl,
      contentType,
    });
  }

  private getExtensionFromContentType(contentType: string): string {
    switch (contentType) {
      case "image/jpeg": return "jpg";
      case "image/png": return "png";
      case "image/webp": return "webp";
      case "video/mp4": return "mp4";
      case "audio/mpeg": return "mp3";
      case "audio/ogg": return "ogg";
      case "audio/amr": return "amr";
      default: return "bin";
    }
  }
}
