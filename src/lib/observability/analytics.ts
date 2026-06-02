import posthog from "posthog-js";
import { isPostHogClientEnabled, posthogConfig } from "./config";
import {
  type AnalyticsEventName,
  type ObservabilityProperties,
  sanitizeEventProperties,
} from "./events";

type IdentifyUser = {
  id: string;
  email?: string | null;
  role?: string | null;
  orgId?: string | null;
  orgSlug?: string | null;
};

export function buildSafeEventPayload(
  eventName: AnalyticsEventName,
  properties: ObservabilityProperties = {},
) {
  return {
    eventName,
    properties: sanitizeEventProperties({
      environment: posthogConfig.environment,
      ...properties,
    }),
  };
}

export function trackEvent(
  eventName: AnalyticsEventName,
  properties: ObservabilityProperties = {},
) {
  if (!isPostHogClientEnabled()) return;

  const payload = buildSafeEventPayload(eventName, properties);
  posthog.capture(payload.eventName, payload.properties);
}

export function identifyUser(user: IdentifyUser) {
  if (!isPostHogClientEnabled()) return;

  posthog.identify(user.id, {
    email: user.email ?? undefined,
    role: user.role ?? undefined,
    orgId: user.orgId ?? undefined,
    orgSlug: user.orgSlug ?? undefined,
  });
}

export function resetUser() {
  if (!isPostHogClientEnabled()) return;

  posthog.reset();
}
