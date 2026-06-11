# AgriData Technologies — Claude Code Instructions

## Start of every session

Before doing anything else, ask:

1. **Who is working?** — Brighton, Kundai, or Munashe (this changes how you respond)
   - Brighton: concise, backend + product-impact framing. He owns backend architecture and strategy, wears the CTO hat day-to-day.
   - Kundai: frontend-first framing, part-time, owns frontend and co-owns product direction.
   - Munashe: implementation detail, PR workflow context — most junior but full-time.
2. **What are we working on?** — ask for the GitHub issue number if there is one, or a short description if it's exploratory. Read the issue before starting.

If the user's first message already makes it obvious (e.g. "fix issue #18"), skip the question it answers.

---

## What this product is

AgriData Technologies is a WhatsApp-first field intelligence platform for agriculture in Southern Africa. It is a product of AakiTech. Field officers and farmers submit structured pest and disease reports via WhatsApp. Those reports feed a multi-tenant dashboard with maps, triage workflows, alert thresholds, and PDF report generation. The platform is config-driven and multi-tenant — each organisation (pilot) has its own pest configurations, workflows, and data isolation.

## Active pilots

| Org | Focus | Status |
|---|---|---|
| **MPBC** | Migratory pest surveillance (Quelea, Fall Armyworm, etc.) | Live, seeded in production |
| **Kutsaga** | Tobacco pest reporting, farmer/contractor advisory | Pilot shipped |
| **ZSAES** | Sugarcane pest scout digitisation and reporting | Demo complete |

Each pilot has its own seed scripts and pest configurations. See `scripts/seed-*.ts` and the [[Pilots]] wiki page.

## Team

| Person | Role |
|---|---|
| Brighton (dev-thandabantu) | CEO / product / backend ownership |
| Kundai (KundaiClayton) | Part-time, owns frontend, co-owns product direction |
| Munashe (dev-munashe) | Full-time developer |
| Law (law001-mugah) | External communications, partner relationships |
| Ona (OnaJonas22) | Design, funding applications, comms support |

Work is sprint-based. Most team members are part-time. Do not assume someone is available — check the current sprint.

## Stack (non-obvious constraints only)

- **Framework:** Next.js 15 App Router — Turbopack in dev
- **API:** tRPC v11 + TanStack Query
- **Database:** PostgreSQL via Drizzle ORM — all tables prefixed `agridata_`. Never edit existing migration files — always `pnpm db:generate` for new migrations.
- **Auth:** Supabase Auth (`@supabase/ssr`)
- **Storage:** Supabase Storage — `reports` bucket must be public
- **WhatsApp:** Twilio — production number in `.env` (`TWILIO_PHONE_NUMBER`)
- **Weather:** Open-Meteo (free, no API key)
- **Styling:** Tailwind CSS v4 — config syntax differs from v3

## Key entry points

```
src/app/          — Next.js pages and API routes
src/server/       — tRPC routers, DB schema, modules
  modules/
    whatsapp-bot/ — Twilio webhook, bot state machine, session management
    weather/      — Open-Meteo enrichment, cron, backfill
    reports/      — Report queries, PDF generation
    triage/       — Expert review workflow
    alerts/       — Severity computation, threshold evaluation
scripts/          — Seed scripts and admin utilities
drizzle/          — Migration SQL files
```

## Local development

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm seed:workflows
pnpm seed:mpbc-pest-configs
pnpm bootstrap-admin
pnpm dev
```

For WhatsApp testing locally: Twilio Sandbox + ngrok. See `src/server/modules/whatsapp-bot/README.md`.

## Roles

- `super_admin` — all orgs; create orgs, manage users, access `/api/trpc-ui`
- `org_admin` — own org only; manage officers, triage, dashboard
- `officer` — WhatsApp only; no dashboard access; identified by phone number

## Key constraints — do not break these

- **Tenant isolation:** Every query touching reports, users, pest configs, sessions, or alert thresholds must be scoped to `orgId`. Super admins can cross boundaries explicitly. Never return cross-org data to an org_admin.
- **Twilio signature validation:** `/api/webhooks/whatsapp` validates the Twilio signature on every request. Do not bypass or weaken this.
- **Migration immutability:** Never edit existing migration files in `drizzle/`. Always `pnpm db:generate`.
- **Pilot config separation:** MPBC, Kutsaga, and ZSAES configs are seeded separately. Do not mix assumptions from one pilot into shared platform logic.
- **Weather enrichment idempotency:** Jobs must be safe to re-run. Do not re-enrich already-enriched records unless explicitly forced.

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

## Deployment

| Environment | Trigger | Target |
|---|---|---|
| Preview | Push to `develop` | Vercel preview URL |
| Production | Merge `develop` → `main` via promote workflow | Vercel production |

CI runs typecheck + build on every push to `develop` and `main`, and on all PRs.

## Docs index

| Page | What it covers |
|---|---|
| [Architecture](https://github.com/aakitech/agridata-ai/wiki/Architecture) | System overview, data flow, module map, data model, roles, weather decisions, WhatsApp commands |
| [Pilots](https://github.com/aakitech/agridata-ai/wiki/Pilots) | MPBC, Kutsaga, ZSAES — status, seed scripts, pest configs, key contacts |
| [Roadmap](https://github.com/aakitech/agridata-ai/wiki/Roadmap) | 60-day commercial roadmap, three-pilot status |
| [Onboarding](https://github.com/aakitech/agridata-ai/wiki/Onboarding) | How to add a new organisation — runbook, readiness checklist |
| [Deployment](https://github.com/aakitech/agridata-ai/wiki/Deployment) | Deployment setup, env vars, Twilio config, pre-launch checklist |
| [Security](https://github.com/aakitech/agridata-ai/wiki/Security) | Security audit findings, non-negotiable constraints |
| [Contributing](https://github.com/aakitech/agridata-ai/wiki/Contributing) | Local setup, branching, PR process, seed scripts |

## Open strategic context

See GitHub issues #33–#36 and [Roadmap](https://github.com/aakitech/agridata-ai/wiki/Roadmap) for current priorities.

---

## Keeping this file current

Update CLAUDE.md when:
- A pilot status changes (live, commercial terms agreed, deprecated)
- A new wiki page is added — add it to the docs index above
- Stack dependencies change in a non-obvious way
- A new key constraint is introduced
- Team membership or roles change

CLAUDE.md is loaded every session. Stale content degrades every AI interaction that follows.
