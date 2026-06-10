# AgriData Technologies

AgriData Technologies is a WhatsApp-first field intelligence platform for agriculture in Southern Africa. Field officers and farmers submit structured pest and disease observations via WhatsApp. Those reports feed a multi-tenant dashboard with maps, triage workflows, severity alerts, and PDF report generation — giving institutions, research boards, and agricultural programs real-time visibility into what is happening on the ground.

## Active pilots

| Pilot | Focus | Status |
|---|---|---|
| **MPBC** | Migratory pest surveillance (Quelea, Fall Armyworm) | Live in production |
| **Kutsaga Research Board** | Tobacco pest reporting, farmer/contractor advisory | Pilot shipped, commercial discussion in progress |
| **ZSAES** | Sugarcane pest scout digitisation, 100-stalk sampling | Demo complete |

## Features

- WhatsApp bot with configurable, org-specific pest reporting workflows
- Multi-tenant — each organisation has isolated data, pest configs, and alert thresholds
- Triage dashboard for expert report review and verification
- Map with clustered markers, severity colour coding, and recency weighting
- Severity alerts with configurable per-org thresholds
- Automatic weather enrichment (temperature, humidity, rainfall) on every report
- PDF report generation for institutional reporting
- Role-based access: super admin, org admin, field officer

## Tech stack

- Next.js 15, tRPC, Drizzle ORM, PostgreSQL
- Supabase (auth + storage), Twilio (WhatsApp), Open-Meteo (weather)
- Deployed on Vercel via GitHub Actions

See [CLAUDE.md](CLAUDE.md) for the full stack reference, module map, data model, and contributor constraints.

## Local development

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL, Supabase keys, Twilio creds
pnpm db:push                # push schema to local DB
pnpm seed:workflows         # seed WhatsApp bot workflow steps
pnpm bootstrap-admin        # create initial super admin user
pnpm dev                    # start dev server
```

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full setup guide, branch conventions, and seed script reference.

## Documentation

| Resource | What it covers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Full project context for contributors and AI-assisted development |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Local setup, branching, PR process, migrations, seed scripts |
| [Wiki — Architecture](../../wiki/Architecture) | System architecture, data flow, module map, data model |
| [Wiki — Pilots](../../wiki/Pilots) | Active pilot reference: status, configs, seed scripts |
| [docs/](docs/) | Feature docs, pilot wikis, deployment guides |

## Discussions

Team announcements, onboarding, and broader conversations happen in [GitHub Discussions](../../discussions).
