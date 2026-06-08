# Architecture

## System overview

AgriData AI is a multi-tenant agricultural field intelligence platform. Field officers and farmers submit pest and disease observations via WhatsApp. The system processes those messages through a configurable bot workflow, stores structured reports, enriches them with weather data, evaluates severity against per-org thresholds, and surfaces everything through a dashboard with maps, triage tools, and PDF reports.

---

## End-to-end data flow

```
Field officer sends WhatsApp message
        │
        ▼
Twilio receives message → POST /api/webhooks/whatsapp
        │
        ▼
Signature validated (HMAC-SHA1)
        │
        ▼
Officer resolved by phone number → org identified → active pest workflow loaded
        │
        ├── Special command (cancel/reset)? → reset session → done
        │
        ▼
Bot state machine steps through pest_workflow_steps
  (pest selection → observation fields → photo count → location)
        │
        ▼
Report created (status: PENDING_TRIAGE)
  + severity computed against org alert thresholds
  + alertTriggered flag set if threshold exceeded
        │
        ├── Media present? → download from Twilio → upload to Supabase Storage
        │
        ▼
Weather enrichment (inline, max 800ms)
  → if timeout: scheduled for async cron enrichment
        │
        ▼
Confirmation message sent to officer via Twilio
        │
        ▼
Org admin reviews report in Triage dashboard
  → VERIFIED or REJECTED
        │
        ▼
Analytics / map / reports surface verified data
```

---

## Module map

| Module | Path | Responsibility |
|---|---|---|
| `whatsapp-bot` | `src/server/modules/whatsapp-bot/` | Twilio webhook handler, bot state machine, session management, workflow processor |
| `alerts` | `src/server/modules/alerts/` | Severity computation, alert threshold evaluation, pest config service |
| `reports` | `src/server/modules/reports/` | Report queries, aggregation, PDF generation |
| `triage` | `src/server/modules/triage/` | Report verification/rejection, expert annotations |
| `analytics` | `src/server/modules/analytics/` | Dashboard data, map clustering, time series, pest distribution |
| `weather` | `src/server/modules/weather/` | Open-Meteo integration, enrichment queuing, retry logic, backfill |
| `media` | `src/server/modules/media/` | Twilio → Supabase storage pipeline, media URL management |

---

## Data model

All tables are prefixed `agridata_`. Schema defined in `src/server/db/schema.ts`.

### Core tables

| Table | Purpose |
|---|---|
| `organizations` | Tenants. Each pilot is an org. Status lifecycle: `DRAFT → CONFIGURING → READY_FOR_TEST → ACTIVE → SUSPENDED` |
| `app_users` | Users with roles (`super_admin`, `org_admin`, `officer`) and org membership. Officers identified by phone number. |
| `reports` | Central report record. Scoped to org. Status: `DRAFT → PENDING_TRIAGE → VERIFIED / REJECTED` |
| `sessions` | Active WhatsApp bot session per user. Stores current workflow step and collected data. |
| `pest_configurations` | Per-org pest definitions |
| `pest_observation_configs` | Observation methods per pest (`PHEROMONE_TRAP`, `FIELD_OBSERVATION`, `EVENT_OBSERVATION`, `SIGN_BASED`) |
| `pest_observation_fields` | Dynamic form fields per observation config (`number`, `select`, `boolean`, `text`) |
| `pest_severity_rules` | Conditional severity rules per observation config (`NUMERIC`, `DERIVED`, `CATEGORICAL`, `DEFAULT`) |
| `org_alert_thresholds` | Per-org, per-pest severity thresholds (normalMax, warningMax) |
| `report_weather` | One-to-one with reports. Weather enrichment status and data. |
| `report_media` | Photos attached to reports. Stored in Supabase Storage (`reports` bucket). |
| `triage_enhancements` | Soft triage annotations by reviewers. |

### Key relationships

```
organizations
  └── app_users (many)
  └── pest_configurations (many)
      └── pest_observation_configs (many)
          └── pest_observation_fields (many)
          └── pest_severity_rules (many)
  └── org_alert_thresholds (many)
  └── reports (many)
      └── report_weather (one)
      └── report_media (many)
      └── triage_enhancements (many)
```

---

## Roles and access

| Role | Access |
|---|---|
| `super_admin` | All orgs. Can create orgs, manage all users, access tRPC UI at `/api/trpc-ui` |
| `org_admin` | Own org only. Manages officers, reviews triage, views dashboard and reports |
| `officer` | WhatsApp only. Submits reports. No dashboard access. Identified by phone number. |

Tenant isolation is enforced at the API layer — every query scopes to `orgId`. There is no database-level row security (RLS) yet.

---

## Multi-tenancy

Each organisation is a fully isolated tenant:

- All reports, users, pest configs, alert thresholds, and sessions are scoped to `orgId`
- Org admins can only see their own org's data
- Super admins can query across orgs explicitly
- Each org has its own pest workflow — the bot loads the active workflow for the officer's org on each message
- Orgs progress through a status lifecycle before they can collect reports

---

## External integrations

| Service | Purpose | Notes |
|---|---|---|
| **Twilio** | WhatsApp messaging, media download | Production number: `whatsapp:+263713618310` |
| **Supabase** | PostgreSQL database, auth (SSR), file storage | Storage bucket: `reports` (must be public) |
| **Open-Meteo** | Weather data enrichment | Free, no API key required |
| **Vercel** | Deployment platform | Preview on `develop` push, production on `main` |

---

## GitHub Actions workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Push/PR to `develop` or `main` | Typecheck + build validation |
| `deploy-preview.yml` | Push to `develop` | Deploy to Vercel preview (QA URL) |
| `deploy-production.yml` | Push to `main` | Deploy to Vercel production |
| `promote-develop-to-main.yml` | Manual | Verifies preview succeeded, merges `develop` → `main` with approval gate |
| `weather-enrichment.yml` | Every 10 minutes | Fetch weather for `PENDING` report records |
| `weather-finalize.yml` | Every 6 hours | Mark completed enrichments, compute derived fields |
| `weather-backfill.yml` | Manual | Bulk backfill weather for historical reports |
