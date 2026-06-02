# PostHog Observability

## Why PostHog First

AgriData starts with PostHog for feature flags, product analytics, privacy-reviewed session replay, and initial error visibility.

Sentry remains deferred. We should add it later if PostHog error tracking is not enough for production debugging, source-map workflows, release tracking, performance tracing, or alerting.

## Environment Variables

```env
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_REPLAY_ENABLED=false
POSTHOG_PERSONAL_API_KEY=
```

`NEXT_PUBLIC_POSTHOG_KEY` is the **project API key** (write/ingest key, starts with `phc_`). It is used for both browser capture and **server-side capture** (it is readable on the server) — server events go through the same project key, not the personal key.

`POSTHOG_PERSONAL_API_KEY` is the **personal API key** (starts with `phx_`). It is optional and only used for local feature-flag evaluation / the management API. It does **not** ingest events, so it must never be the value posthog-node is initialised with.

Missing PostHog config must not break local development. If the project key is missing, browser analytics, feature flag calls, and server-side capture all become no-ops.

## Event Map

| Area | Event |
| --- | --- |
| Auth | `user_logged_in` |
| Dashboard | `dashboard_viewed` |
| Reports | `reports_list_viewed` |
| Reports | `report_detail_viewed` |
| Reports | `report_export_started` |
| Reports | `report_export_completed` |
| Reports | `report_export_failed` |
| Map | `map_viewed` |
| Filters | `dashboard_filter_changed` |
| Triage | `report_triage_started` |
| Triage | `report_triage_completed` |
| WhatsApp/Webhook | `whatsapp_webhook_error` |
| Feature Flags | `feature_flag_evaluated` |

## Shared Properties

Use safe identifiers and routing context where available:

```ts
{
  userId,
  orgId,
  orgSlug,
  role,
  environment,
  route,
  feature,
  reportId,
  workflowId,
}
```

## Privacy Rules

Do not send report content, raw WhatsApp messages, phone numbers, free-form notes, sensitive form values, or institutional report text to PostHog.

The sanitizer in `src/lib/observability/events.ts` removes known sensitive keys before capture. It is a guardrail, not permission to pass sensitive data into tracking calls.

Session replay is disabled by default. Enable it only after PostHog replay privacy settings are reviewed for the target environment. Browser replay masks text by default.

## Adding Events

Add event names to `src/lib/observability/events.ts`.

For browser-side analytics:

```ts
import { trackEvent } from "~/lib/observability/analytics";
import { analyticsEvents } from "~/lib/observability/events";

trackEvent(analyticsEvents.dashboardViewed, {
  route: "/dashboard",
  userId,
  orgId,
});
```

For server-side analytics:

```ts
import { captureServerEvent } from "~/lib/observability/server";
import { analyticsEvents } from "~/lib/observability/events";

await captureServerEvent(analyticsEvents.userLoggedIn, {
  route: "/login",
  userId,
});
```

Do not import `posthog-js` or `posthog-node` directly in feature code.

## Feature Flags

In React components, use the hook. It re-evaluates when PostHog finishes loading
flags (so gated UI isn't stuck on the pre-bootstrap default) and tracks one
`feature_flag_evaluated` event per mount:

```ts
import { useFeatureFlag } from "~/lib/observability/feature-flags";
import { featureFlags } from "~/lib/observability/events";

const enabled = useFeatureFlag(featureFlags.newDashboardCards, {
  userId,
  orgId,
});
```

For one-shot, non-React evaluation use `isFeatureEnabled(flagKey, context)`. Note
it can read a stale `false` on the client if called before flags load — prefer
the hook in components.

Initial flags:

| Flag | Purpose |
| --- | --- |
| `new-dashboard-cards` | Gate dashboard UI changes |
| `report-export-v2` | Gate new export/reporting logic |
| `experimental-triage-flow` | Gate triage improvements |
| `org-specific-workflows` | Gate organisation-specific workflow changes |

## Error Tracking

Use the internal error wrapper:

```ts
import { captureError } from "~/lib/observability/errors";

await captureError(error, {
  route: "/api/webhooks/whatsapp",
  feature: "whatsapp-webhook",
});
```

`captureError` routes to PostHog today. If Sentry is added later, route Sentry behind this wrapper so feature code does not change.

The raw error is never forwarded as-is: `captureError` rebuilds a clean error with only `name`, `message`, and `stack` (via `toSafeError`), so any custom fields attached to the thrown error (e.g. a phone number or raw payload) cannot leak.

Server-side capture runs after the response where possible (`after()` from `next/server` in the login action and WhatsApp webhook) so analytics never adds latency to the request.

## Current MVP Instrumentation

- `user_logged_in` from the login server action.
- `dashboard_viewed` from the dashboard page after the current user loads.
- `reports_list_viewed` from the reports page after the current user loads.
- `whatsapp_webhook_error` from safe WhatsApp webhook validation and catch paths.
- `feature_flag_evaluated` from the feature flag helper.
