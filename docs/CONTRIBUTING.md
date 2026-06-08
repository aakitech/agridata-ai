# Contributing to AgriData AI

## Prerequisites

- Node.js 20
- pnpm 9.1.0 (`npm install -g pnpm@9.1.0`)
- PostgreSQL (local instance or a hosted dev DB)
- Twilio Sandbox account — optional, only needed for local WhatsApp testing

## Local setup

```bash
# 1. Clone
git clone https://github.com/aakitech/agridata-ai.git
cd agridata-ai

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, Supabase keys, and Twilio creds

# 4. Push schema to your local DB
pnpm db:push

# 5. Seed required data
pnpm seed:workflows              # WhatsApp bot workflow steps (required)
pnpm seed:mpbc-pest-configs      # MPBC pest configurations

# 6. Create a super admin user
pnpm bootstrap-admin

# 7. Start dev server
pnpm dev
```

For WhatsApp testing locally, use Twilio Sandbox + ngrok. See `src/server/modules/whatsapp-bot/README.md`.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL e.g. `http://localhost:3000` |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Yes | e.g. `whatsapp:+263713618310` |
| `WEATHER_ENRICHMENT_ENABLED` | No | Default `true` |
| `WEATHER_INLINE_ENRICHMENT_ENABLED` | No | Default `true` |
| `WEATHER_ENRICHMENT_CRON_SECRET` | No | Required for cron endpoint in production |

Ask Brighton or Kundai for production/staging values. Never commit `.env` files.

## Branch conventions

| Prefix | Use for |
|---|---|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Config, deps, tooling |

All PRs target `develop`. Never push directly to `main` — it is only updated via the `Promote Develop to Main` workflow.

## Pull request process

1. Branch from `develop`
2. Make your changes
3. Push and open a PR against `develop`
4. CI runs automatically — typecheck and build must pass
5. Tag a reviewer — do not merge your own PR without review (except trivial docs/config)
6. Merge once approved and CI is green

## Database migrations

**Never edit existing files in `drizzle/`.** Migrations are immutable once created.

To make a schema change:
```bash
# Edit src/server/db/schema.ts
pnpm db:generate    # generates a new migration file in drizzle/
pnpm db:migrate     # applies it
```

For local prototyping only, `pnpm db:push` applies schema changes directly without generating a migration file. Switch to `db:generate` + `db:migrate` before opening a PR.

## Seed scripts

| Script | Command | Purpose |
|---|---|---|
| Workflow steps | `pnpm seed:workflows` | WhatsApp bot workflow steps — required for bot to function |
| MPBC pest configs | `pnpm seed:mpbc-pest-configs` | MPBC pest configurations |
| Kutsaga configs | `pnpm seed:kutsaga-placeholder` | Kutsaga placeholder pest configs |
| Kutsaga refresh | `pnpm seed:kutsaga-placeholder:refresh` | Wipe and re-seed Kutsaga configs |
| ZSAES configs | `pnpm seed:zsaes-pest-configs` | ZSAES pest configurations |
| ZSAES refresh | `pnpm seed:zsaes-pest-configs:refresh` | Wipe and re-seed ZSAES configs |
| MPBC test data | `pnpm seed:mpbc-30day` | 30 days of test report data for MPBC |
| Bootstrap admin | `pnpm bootstrap-admin` | Create initial super admin user |

## Diagnostic scripts

These are one-off operational scripts in `scripts/`. Run with `npx tsx --env-file=.env scripts/<name>.ts`.

| Script | Purpose |
|---|---|
| `diagnose-blocked-users.ts` | Find users blocked from accessing the system |
| `fix-blocked-user.ts` | Unblock a specific user |
| `debug-user.ts` | Inspect user state |
| `list_orgs.ts` | List all organisations |
| `check-db.ts` | Verify DB connectivity and basic schema |
| `verify-invite.ts` | Debug org invite flow |
| `verify-report-data.ts` | Verify report data integrity |
| `cleanup-test-data.ts` | Remove test data from a DB |
| `diagnose-migration-state.ts` | Check migration history and state |

## Key constraints

See [CLAUDE.md](../CLAUDE.md) for the full list. The critical ones:

- **Tenant isolation** — every query must scope to `orgId`. Never return cross-org data to an org admin.
- **Twilio signature validation** — do not bypass the webhook signature check.
- **Migration immutability** — never edit existing `drizzle/` files.
- **Pilot config separation** — MPBC, Kutsaga, and ZSAES configs are seeded separately. Do not hardcode pilot-specific assumptions into shared platform logic.
