# Azure Scheduler Setup for Weather Enrichment

This guide sets up Azure DevOps scheduled pipelines to trigger weather cron endpoints on Vercel.

## Files Added

- `/Users/mohara/Documents/aakitech/Saas/agridata/azure-pipelines-weather-enrichment-prod.yml`
- `/Users/mohara/Documents/aakitech/Saas/agridata/azure-pipelines-weather-finalize-prod.yml`
- `/Users/mohara/Documents/aakitech/Saas/agridata/azure-pipelines-weather-backfill-manual.yml`

## 1) Required Environment/Secret Variables

Add these to your Azure DevOps variable group (recommended: `Vercel-Deploy-Variables-Prod`):

- `WEATHER_CRON_BASE_URL`
  - Example prod: `https://your-prod-domain.com`
  - Example QA: `https://agridata-ai-qa.aakitech.com`
- `WEATHER_ENRICHMENT_CRON_SECRET` (mark as secret)
  - Must match Vercel env var `WEATHER_ENRICHMENT_CRON_SECRET`.

Optional overrides in Azure pipeline UI:
- `WEATHER_ENRICHMENT_BATCH_SIZE` (default in YAML: `50`)
- `WEATHER_FINALIZE_BATCH_SIZE` (default in YAML: `50`)

## 2) Vercel Prerequisites

In Vercel project env vars (Preview/Production as needed), ensure:
- `WEATHER_ENRICHMENT_CRON_SECRET`
- `WEATHER_PROVIDER`
- `WEATHER_ENRICHMENT_BATCH_SIZE`
- `WEATHER_ENRICHMENT_MAX_RETRIES`
- `WEATHER_ENRICHMENT_BASE_BACKOFF_MINUTES`
- `WEATHER_DEFAULT_TIMEZONE`

## 3) Create Azure Pipelines

In Azure DevOps:

1. Go to `Pipelines` -> `New pipeline`.
2. Choose your repo.
3. Choose `Existing Azure Pipelines YAML file`.
4. Create these three pipelines, one by one:
   - `azure-pipelines-weather-enrichment-prod.yml`
   - `azure-pipelines-weather-finalize-prod.yml`
   - `azure-pipelines-weather-backfill-manual.yml`

## 4) What Each Pipeline Does

### Enrichment pipeline (scheduled)
- File: `azure-pipelines-weather-enrichment-prod.yml`
- Schedule: every 10 minutes (UTC)
- Endpoint: `/api/cron/weather-enrichment?batchSize=...`

### Finalize pipeline (scheduled)
- File: `azure-pipelines-weather-finalize-prod.yml`
- Schedule: every 6 hours (UTC)
- Endpoint: `/api/cron/weather-finalize?batchSize=...`

### Backfill pipeline (manual)
- File: `azure-pipelines-weather-backfill-manual.yml`
- Trigger: manual run only
- Endpoint: `/api/cron/weather-backfill?limit=...&orgId=...&from=...&to=...`

## 5) QA Setup (Recommended before Production)

Use the same YAML pattern for QA by doing one of the following:

1. Duplicate each pipeline and point variable group to your QA group (`Vercel-Deploy-Variables-Dev`) where:
   - `WEATHER_CRON_BASE_URL=https://agridata-ai-qa.aakitech.com`
   - `WEATHER_ENRICHMENT_CRON_SECRET=<qa-secret>`

2. Or create QA-specific YAML copies with `variables.group` set to dev group and branch include `develop`.

## 6) Validation Steps

### A) Manual run enrichment pipeline
Expected log behavior:
- Calls endpoint successfully
- Prints JSON body like `{"success":true,...}`
- HTTP code in 2xx

### B) Verify data in Supabase

```sql
select status, count(*)
from agridata_report_weather
group by status
order by status;
```

```sql
select observed_local_date, count(*) weather_rows
from agridata_report_weather
group by observed_local_date
order by observed_local_date desc
limit 14;
```

### C) Verify pending queue drops over time

```sql
select count(*) as pending
from agridata_report_weather
where status = 'PENDING';
```

## 7) Operational Notes

1. Azure schedule cron is interpreted in UTC.
2. Endpoint auth uses `x-cron-secret` and Bearer token from the same secret.
3. Keep backfill manual to avoid sudden provider quota spikes.
4. If you need fresher data, reduce enrichment interval to 5 minutes (watch provider/API limits).

## 8) Failure Handling Checklist

If pipeline fails:
1. Confirm `WEATHER_CRON_BASE_URL` is correct and publicly reachable.
2. Confirm `WEATHER_ENRICHMENT_CRON_SECRET` matches Vercel env exactly.
3. Check Vercel function logs for `/api/cron/weather-enrichment` or `/api/cron/weather-finalize`.
4. Check `report_weather.error_code` values for provider/parse failures.

## 9) Suggested Initial Cadence

- Enrichment: every 10 minutes
- Finalize: every 6 hours
- Backfill: manual batches (`limit=200-1000`) during controlled windows
