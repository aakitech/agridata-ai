export const analyticsEvents = {
  userLoggedIn: "user_logged_in",
  dashboardViewed: "dashboard_viewed",
  reportsListViewed: "reports_list_viewed",
  reportDetailViewed: "report_detail_viewed",
  reportExportStarted: "report_export_started",
  reportExportCompleted: "report_export_completed",
  reportExportFailed: "report_export_failed",
  mapViewed: "map_viewed",
  dashboardFilterChanged: "dashboard_filter_changed",
  reportTriageStarted: "report_triage_started",
  reportTriageCompleted: "report_triage_completed",
  whatsappWebhookError: "whatsapp_webhook_error",
  featureFlagEvaluated: "feature_flag_evaluated",
} as const;

export const featureFlags = {
  newDashboardCards: "new-dashboard-cards",
  reportExportV2: "report-export-v2",
  experimentalTriageFlow: "experimental-triage-flow",
  orgSpecificWorkflows: "org-specific-workflows",
} as const;

export type AnalyticsEventName =
  (typeof analyticsEvents)[keyof typeof analyticsEvents];

export type FeatureFlagKey = (typeof featureFlags)[keyof typeof featureFlags];

export type ObservabilityProperties = Record<string, unknown> & {
  userId?: string;
  orgId?: string;
  orgSlug?: string;
  role?: string;
  environment?: string;
  route?: string;
  feature?: string;
  reportId?: string;
  workflowId?: string;
};

const sensitiveKeys = new Set([
  "body",
  "content",
  "messagebody",
  "phonenumber",
  "phone",
  "rawmessage",
  "reportcontent",
  "text",
  "notes",
  "email",
  "password",
  "token",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Drops known sensitive keys (case-insensitively) at every level of nesting.
 * This is a guardrail, not permission to pass sensitive data into tracking
 * calls. Arrays and non-plain objects (Date, etc.) are passed through as-is.
 */
export function sanitizeEventProperties(
  properties: ObservabilityProperties = {},
) {
  const sanitizeValue = (value: unknown): unknown =>
    isPlainObject(value)
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !sensitiveKeys.has(key.toLowerCase()))
            .map(([key, val]) => [key, sanitizeValue(val)]),
        )
      : value;

  return sanitizeValue(properties) as Record<string, unknown>;
}
