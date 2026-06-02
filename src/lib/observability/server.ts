import "server-only";

import { PostHog } from "posthog-node";
import { env } from "~/env";
import {
  analyticsEvents,
  type AnalyticsEventName,
  type ObservabilityProperties,
  sanitizeEventProperties,
} from "./events";

let serverClient: PostHog | null = null;

/**
 * Server-side capture uses the PostHog *project* API key (the same write key as
 * `NEXT_PUBLIC_POSTHOG_KEY`, readable on the server). The *personal* API key is
 * only used for local feature-flag evaluation / the management API, so it must
 * not gate or initialise event capture.
 */
export function isPostHogServerEnabled() {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function getPostHogServerClient() {
  if (!isPostHogServerEnabled()) return null;

  serverClient ??= new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
    // Optional: enables local feature-flag evaluation without a network round-trip.
    personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
    flushAt: 1,
    flushInterval: 0,
  });

  return serverClient;
}

export async function captureServerEvent(
  eventName: AnalyticsEventName,
  properties: ObservabilityProperties = {},
) {
  const safeProperties = sanitizeEventProperties({
    environment: env.NODE_ENV,
    ...properties,
  });
  const client = getPostHogServerClient();

  if (!client) {
    return;
  }

  client.capture({
    distinctId: String(properties.userId ?? properties.orgId ?? "server"),
    event: eventName,
    properties: safeProperties,
  });

  await client.flush();
}

export async function captureWebhookError(
  reason: string,
  properties: ObservabilityProperties = {},
) {
  await captureServerEvent(analyticsEvents.whatsappWebhookError, {
    ...properties,
    reason,
  });
}
