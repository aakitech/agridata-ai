import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string(),
    TWILIO_AUTH_TOKEN: z.string(),
    TWILIO_PHONE_NUMBER: z.string(),
    WEATHER_PROVIDER: z.enum(["open-meteo"]).default("open-meteo"),
    WEATHER_ENRICHMENT_CRON_SECRET: z.string().min(16).optional(),
    WEATHER_ENRICHMENT_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(25),
    WEATHER_ENRICHMENT_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
    WEATHER_ENRICHMENT_BASE_BACKOFF_MINUTES: z.coerce.number().int().min(1).max(120).default(5),
    WEATHER_DEFAULT_TIMEZONE: z.string().default("Africa/Harare"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    WEATHER_PROVIDER: process.env.WEATHER_PROVIDER,
    WEATHER_ENRICHMENT_CRON_SECRET: process.env.WEATHER_ENRICHMENT_CRON_SECRET,
    WEATHER_ENRICHMENT_BATCH_SIZE: process.env.WEATHER_ENRICHMENT_BATCH_SIZE,
    WEATHER_ENRICHMENT_MAX_RETRIES: process.env.WEATHER_ENRICHMENT_MAX_RETRIES,
    WEATHER_ENRICHMENT_BASE_BACKOFF_MINUTES: process.env.WEATHER_ENRICHMENT_BASE_BACKOFF_MINUTES,
    WEATHER_DEFAULT_TIMEZONE: process.env.WEATHER_DEFAULT_TIMEZONE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
