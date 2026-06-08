# AgriData AI — Claude Code Instructions

## What this product is

AgriData AI is a WhatsApp-first field intelligence platform for agriculture in Southern Africa. Field officers and farmers submit structured pest and disease reports via WhatsApp. Those reports feed a multi-tenant dashboard with maps, triage workflows, alert thresholds, and PDF report generation. The platform is config-driven and multi-tenant — each organisation (pilot) has its own pest configurations, workflows, and data isolation.

The WhatsApp bot is the field interface. The real product is the intelligence layer behind it: structured data collection, surveillance, dashboards, escalation, and reporting.

## Active pilots

| Org | Focus | Status |
|---|---|---|
| **MPBC** | Migratory pest surveillance (Quelea, Fall Armyworm, etc.) | Live, seeded in production |
| **Kutsaga** | Tobacco pest reporting, farmer/contractor advisory | Pilot shipped, commercial terms in discussion |
| **ZSAES** | Sugarcane pest scout digitisation and reporting | Demo implementation complete |

Each pilot has its own seed scripts and pest configurations. See `scripts/seed-*.ts` and `docs/` for pilot-specific context.

## Team

| Person | Role |
|---|---|
| Brighton (dev-thandabantu) | CEO / product |
| Kundai (kundai@aakitech.com) | Lead developer |
| Munashe (munashe@aakitech.com) | Developer |
| Law (law001-mugah) | Developer |

Work is sprint-based. Ownership is assigned at sprint refinement based on capacity. Most team members are part-time. Do not assume someone is available — check the current sprint.

## Stack

- **Framework:** Next.js 15 (App Router, Turbopack in dev)
- **API:** tRPC v11 + TanStack Query
- **Database:** PostgreSQL via Drizzle ORM — all tables prefixed `agridata_`
- **Auth:** Supabase Auth (`@supabase/ssr`)
- **Storage:** Supabase Storage (`reports` bucket — must be public)
- **WhatsApp:** Twilio (`whatsapp:+263713618310` is the production number)
- **Weather:** Open-Meteo (free, no API key needed)
- **PDF:** PDFKit
- **Maps:** Leaflet + react-leaflet-cluster
- **Charts:** Recharts
- **Styling:** Tailwind CSS v4
- **Runtime:** Node 20, pnpm 9.1.0

## Project structure

```
src/
  app/                  # Next.js App Router pages
    dashboard/          # Main dashboard (org admins, super admins)
    auth/               # Login, onboarding, accept-invite
    api/                # API routes (webhooks, tRPC, cron)
  server/
    api/                # tRPC routers
    db/                 # Drizzle schema, seed, index
    modules/
      alerts/           # Alert threshold evaluation
      analytics/        # Usage analytics
      media/            # Supabase storage helpers
      reports/          # Report queries and PDF generation
      triage/           # Report review workflow
      weather/          # Open-Meteo enrichment, scheduling, backfill
      whatsapp-bot/     # Twilio webhook, bot state machine, session management
  lib/                  # Shared utilities
  trpc/                 # tRPC client setup
  middleware.ts         # Supabase auth middleware (protects all dashboard routes)
scripts/                # Admin, seed, diagnostic, and migration scripts
docs/                   # Feature docs, pilot wikis, planning docs
drizzle/                # Migration SQL files
```

## Data model (key tables)

All tables are prefixed `agridata_`. Core tables:

- `organizations` — tenants; each pilot is an org with a status lifecycle (`DRAFT` → `ACTIVE`)
- `app_users` — users with roles (`super_admin`, `org_admin`, `officer`) and org membership
- `reports` — pest/disease field reports; scoped to org; enriched with weather after submission
- `sessions` — active WhatsApp bot sessions per phone number
- `pest_configurations` — per-org pest definitions with observation fields, severity rules, and alert thresholds
- `pest_workflow_steps` — ordered prompt steps for the WhatsApp conversation flow
- `weather_records` — enriched weather data attached to reports by location and date

Schema lives in `src/server/db/schema.ts`. Migrations in `drizzle/`.

## Roles and access

- `super_admin` — sees all orgs; can create orgs, manage users, access tRPC UI (`/api/trpc-ui`)
- `org_admin` — scoped to their org; manages officers, reviews triage, views dashboard
- `officer` — field user; interacts only via WhatsApp; registered by phone number

## WhatsApp bot flow

1. Twilio posts to `/api/webhooks/whatsapp` on every incoming message
2. Middleware validates Twilio signature
3. Bot resolves the officer by phone number → finds their org → loads active pest workflow
4. State machine steps through configured `pest_workflow_steps` (label selection, photo count, location)
5. On completion, creates a `report` record with `PENDING_TRIAGE` status
6. Weather enrichment runs inline (timeout: 800ms) then async via cron if needed

Special commands: `cancel` resets the session at any point.

## Weather enrichment

Reports are enriched with Open-Meteo weather data (temperature min/max, humidity, precipitation) after submission. Three paths:

- **Inline:** attempts enrichment synchronously within 800ms of report creation
- **Cron:** `/api/cron/weather-enrichment` picks up `PENDING` records in batches
- **Backfill:** manual pipeline via `azure-pipelines-weather-backfill-manual.yml`

Controlled by env flags: `WEATHER_ENRICHMENT_ENABLED`, `WEATHER_INLINE_ENRICHMENT_ENABLED`.

## Local development

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL, Supabase keys, Twilio creds
pnpm db:push                  # push schema to local DB (first time)
pnpm seed:workflows           # seed WhatsApp bot workflow steps
pnpm seed:mpbc-pest-configs   # seed MPBC pest configs
pnpm bootstrap-admin          # create initial super admin
pnpm dev                      # start dev server (Turbopack)
```

For WhatsApp testing locally, use Twilio Sandbox + ngrok. See `src/server/modules/whatsapp-bot/README.md`.

## Seed scripts

| Script | Purpose |
|---|---|
| `seed:workflows` | WhatsApp bot workflow steps (required for bot to function) |
| `seed:mpbc-pest-configs` | MPBC pest configurations |
| `seed:kutsaga-placeholder` | Kutsaga placeholder pest configs |
| `seed:zsaes-pest-configs` | ZSAES pest configurations |
| `seed:mpbc-30day` | 30 days of test report data for MPBC |
| `bootstrap-admin` | Creates initial super admin user |

## Deployment

| Environment | Trigger | Target |
|---|---|---|
| Preview | Push to `develop` | Vercel preview URL (auto-aliased) |
| Production | Merge `develop` → `main` via promote workflow | Vercel production |

Workflows: `.github/workflows/`. The `promote-develop-to-main.yml` workflow handles the production promotion gate.

CI runs typecheck + build on every push to `develop` and `main`, and on all PRs.

## Key constraints — do not break these

- **Tenant isolation:** Every query that touches reports, users, pest configs, or sessions must be scoped to an org. Super admins can cross org boundaries explicitly. Never return cross-org data to an org_admin.
- **Twilio signature validation:** The webhook at `/api/webhooks/whatsapp` validates the Twilio signature on every request. Do not bypass or weaken this.
- **Migration immutability:** Never edit existing migration files in `drizzle/`. Always generate a new migration with `pnpm db:generate`.
- **Pilot config separation:** MPBC, Kutsaga, and ZSAES configs are seeded separately. Do not mix or hardcode assumptions from one pilot into shared platform logic.
- **Weather enrichment idempotency:** Enrichment jobs must be safe to re-run. Do not re-enrich already-enriched records unless explicitly forced.

## Environment variables

See `src/env.js` for the full validated schema. Required for local dev:

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

## Docs index

| File | What it covers |
|---|---|
| `docs/KUTSAGA_TRACK_A_WHATSAPP_PILOT_WIKI.md` | Kutsaga pilot architecture, track split, comm history |
| `docs/MULTI_TENANT_ONBOARDING_READINESS_PLAN.md` | Onboarding runbook and roadmap |
| `docs/PRODUCTION_READINESS.md` | Production setup checklist |
| `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` | Deployment process |
| `docs/FEATURE_MAP_MVP.md` | MVP feature map |
| `docs/ZSAES_WHATSAPP_DEMO_IMPLEMENTATION_PLAN.md` | ZSAES demo plan |
| `docs/FEATURE_WHATSAPP_SESSION_COMMANDS_PRD.md` | WhatsApp session commands spec |
| `docs/FEATURE_WEATHER_ENRICHMENT_DECISIONS.md` | Weather enrichment design decisions |

## Open strategic context

The project is in a pre-revenue phase. Three pilots (MPBC, Kutsaga, ZSAES) are live or demo-ready but on MOU terms. The 60-day priority is converting the Kutsaga relationship into a paid commercial pilot. See GitHub issues #33–#36 for the current strategy discussion.
