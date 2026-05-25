# GitHub Migration Runbook

This runbook tracks the phased move from Azure DevOps Pipelines to GitHub Actions.

## Current Migration Shape

- Azure DevOps remains the existing `origin` remote during the transition.
- GitHub is added as a separate `github` remote: `https://github.com/aakitech/agridata-ai.git`.
- GitHub Actions will own CI, QA deploys, production deploys, and weather scheduler calls after validation.
- Azure Pipelines should only be disabled after the equivalent GitHub workflows have succeeded.

## GitHub Environments and Secrets

Create these GitHub environments in the private repo.

### `preview`

Used by `deploy-preview.yml`.

- `DATABASE_URL`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### `production`

Used by `deploy-production.yml` and the weather workflows.

- `DATABASE_URL`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `WEATHER_CRON_BASE_URL`
- `WEATHER_ENRICHMENT_CRON_SECRET`

Recommended production values:

- `WEATHER_CRON_BASE_URL`: production app URL, without a trailing slash
- `WEATHER_ENRICHMENT_CRON_SECRET`: same value configured in Vercel production env

## Workflow Rollout Order

1. Push `develop` and `main` to the new GitHub repo.
2. Add GitHub environments and secrets.
3. Run the `CI` workflow manually on `develop`.
4. Trigger `Deploy Preview` and confirm the QA alias updates.
5. Trigger `Weather Enrichment` manually and confirm a `2xx` response.
6. Trigger `Weather Finalize` manually and confirm a `2xx` response.
7. Test `Weather Backfill` with a small `limit`.
8. Merge or push a controlled change to `main` and confirm production deploy.
9. Disable the Azure weather scheduler pipelines.
10. Disable Azure deploy pipelines after GitHub production deploys are stable.

## Production Promotion

Production promotion is handled by the `Promote Develop to Main` workflow.

Expected flow:

1. `develop` deploys successfully to QA through `Deploy Preview`.
2. A user runs `Actions` -> `Promote Develop to Main` -> `Run workflow`.
3. GitHub pauses on the `production-promotion` environment approval gate.
4. After approval, the workflow verifies the latest `Deploy Preview` succeeded for the current `develop` commit.
5. The workflow merges `develop` into `main`.
6. The `Deploy Production` workflow starts from the `main` push.

Create a GitHub environment named `production-promotion` and add required reviewers there if a click-to-approve gate is needed before merging to `main`.

## Cost Guardrails

- Weather enrichment runs about 4,320 times per month at a 10-minute cadence.
- Weather finalize runs about 120 times per month at a 6-hour cadence.
- Configure GitHub Actions budget alerts before enabling scheduled workflows for the long term.
- Revisit moving weather scheduling out of GitHub Actions in Phase 2.

## Phase 2 Candidates

Research a dedicated scheduler after the GitHub migration is stable.

- Cloudflare Workers Cron Triggers
- Azure Functions Timer Trigger
- GitHub Actions with reduced cadence
- Other low-cost HTTP schedulers with secret support and reliable logs
