import { type ObservabilityProperties, sanitizeEventProperties } from "./events";

export function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error",
  };
}

/**
 * Build a clean Error carrying only name/message/stack. The original error may
 * have arbitrary enumerable fields attached (e.g. a phone number or raw
 * payload); those must never reach PostHog, so we never forward the raw object.
 */
export function toSafeError(error: unknown) {
  const normalized = normalizeError(error);
  const safeError = new Error(normalized.message);
  safeError.name = normalized.name;
  if (error instanceof Error && error.stack) {
    safeError.stack = error.stack;
  }
  return safeError;
}

export async function captureError(
  error: unknown,
  context: ObservabilityProperties = {},
) {
  const normalized = normalizeError(error);
  const properties = sanitizeEventProperties({
    ...context,
    errorName: normalized.name,
    errorMessage: normalized.message,
  });
  const { getPostHogServerClient } = await import("./server");
  const client = getPostHogServerClient();

  if (!client) {
    console.error("[Observability Error]", normalized, properties);
    return;
  }

  await client.captureExceptionImmediate(
    toSafeError(error),
    String(context.userId ?? context.orgId ?? "server"),
    properties,
  );
}

export async function captureMessage(
  message: string,
  context: ObservabilityProperties = {},
) {
  const properties = sanitizeEventProperties({
    ...context,
    message,
  });
  const { getPostHogServerClient } = await import("./server");
  const client = getPostHogServerClient();

  if (!client) {
    console.info("[Observability Message]", message, properties);
    return;
  }

  client.capture({
    distinctId: String(context.userId ?? context.orgId ?? "server"),
    event: "observability_message",
    properties,
  });
  await client.flush();
}
