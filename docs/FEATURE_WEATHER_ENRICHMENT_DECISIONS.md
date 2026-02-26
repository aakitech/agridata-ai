# Weather Enrichment v1 - Decision Log

## Context

AgriData collects field pest reports from scouts via WhatsApp. To keep reporting friction low and preserve adoption, weather data should be enriched in the backend rather than requested from scouts during report submission.

The immediate product need is to give admins weather context (especially rainfall and temperature) alongside pest reports for operational decisions and early pattern recognition.

The system must work for Zimbabwe field conditions, support near-real-time dashboard usage, and remain robust as user volume grows.

## Clarification: `observed_local_date`

`observed_local_date` is the **local calendar date at the report location/timezone** used to anchor daily weather values.

Example:
- A report arrives at `2026-02-18T22:30:00Z`
- In Zimbabwe (`Africa/Harare`, UTC+2), local time is `2026-02-19 00:30`
- `observed_local_date = 2026-02-19`

This prevents day-boundary errors when converting UTC timestamps into daily weather fields like daily rain and daily min/max temperature.

## Decisions Made

### 1) WhatsApp UX: no weather questions in v1

Decision:
- Do not ask scouts for rainfall/temperature in WhatsApp for v1.

Why:
- Protect completion rate and reduce cognitive load.
- Keep ingestion flow fast and reliable.

Tradeoff:
- Weather accuracy depends on external provider estimates, not scout self-report.

### 2) Rainfall definition for v1

Decision:
- Use **daily local-date rainfall total** (`rain_day_mm`) for the report's `observed_local_date`.
- Keep `rain_24h_mm` as a possible future field if rolling-window biology signals are needed.

Why:
- Stable, simple, and easy to explain in daily operations.
- Aligns with pilot behavior where reviews are often daily rather than minute-by-minute.

Tradeoff:
- Midday reports may not reflect a strict rolling previous 24 hours.

### 3) Temperature fields

Decision:
- Store daily `temp_min_c`, `temp_max_c`, `temp_mean_c`.

Why:
- Sufficient for early correlation and risk interpretation.
- Lower complexity/cost than hourly timeseries.

Tradeoff:
- Loses intraday spikes.

### 4) Provider architecture

Decision:
- Implement provider abstraction now.
- Start with one primary provider in v1; keep fallback provider slot ready.

Why:
- Fast MVP delivery without locking architecture.
- Enables future resilience without major refactor.

Tradeoff:
- Initial fallback coverage is limited until second provider is integrated.

### 5) Enrichment execution model

Decision:
- Asynchronous enrichment pipeline (never block report ingestion).
- Report saved immediately, weather row created as `PENDING`, cron worker processes queue.

Why:
- Preserves reliability and latency of WhatsApp ingestion.
- Operationally acceptable near-real-time (minutes).

Tradeoff:
- Dashboard may briefly show `Pending weather`.

### 6) Trust and transparency model

Decision:
- Treat weather as **estimated external data**, not absolute ground truth.
- Show source and freshness metadata in UI.
- Use quality flags for triage (`PLAUSIBLE`, `SUSPECT`).

Why:
- Reduces false confidence in location-specific precision.
- Supports operational trust and auditing.

Tradeoff:
- Slightly more UI complexity.

### 7) Data model approach

Decision:
- Use separate weather enrichment storage (not inline weather columns on `reports`).

Why:
- Cleaner retries/backfills.
- Keeps core report queries lean.
- Better auditability for provider and quality metadata.

Tradeoff:
- Extra joins on read paths where weather is displayed.

## Data Model and Indexing Guidance

Core table: `report_weather`
- `report_id` (unique FK to `reports.id`)
- `org_id`
- `lat`, `lon`
- `observed_at` (report timestamp)
- `observed_local_date`
- `timezone` (default `Africa/Harare` for current rollout)
- `grid_key`
- `source`
- `status` (`PENDING | OK | FAILED | NEEDS_REVIEW`)
- `attempt_count`, `next_retry_at`, `last_error_at`, `error_code`
- `fetched_at`
- `rain_day_mm`, `rain_7d_mm`
- `temp_min_c`, `temp_max_c`, `temp_mean_c`
- `quality_flag` (`UNKNOWN | PLAUSIBLE | SUSPECT`)
- optional raw audit fields: `provider_payload`, `provider_version`

Recommended indexes:
- unique(`report_id`)
- index(`status`, `next_retry_at`) for queue scanning
- index(`org_id`, `observed_at` desc)
- index(`grid_key`, `observed_local_date`)
- index(`quality_flag`, `status`) for review queue

## Operational Constraints (Serverless + Growth)

- Use small cron batches (start 25-50 per run).
- Use row-locking safe queue selection in SQL (e.g., `FOR UPDATE SKIP LOCKED`) to avoid duplicate workers.
- Add retry with exponential backoff and max attempts.
- Never fail report ingestion because weather failed.
- Track queue-age and failure-rate metrics from day one.

## UI Behavior (v1)

In report details:
- Show rainfall + temperatures + source label + fetched time.
- Show status badge: `Pending`, `Estimated`, `Needs Review`, `Unavailable`.
- If unavailable, render weather block gracefully without breaking report usability.

## Evolution Path (post-v1)

1. Add fallback provider integration.
2. Add limited calibration pilot for optional user-entered weather inputs.
3. Compare user-entered values against provider estimates for quality scoring.
4. Add pest-specific lifecycle interpretation layer using weather trends (separate from core enrichment).
5. Introduce rolling-window fields (e.g., true rolling 24h rain) if modeling requires it.

## Why This Is the Chosen MVP

This plan balances:
- **Speed:** can ship quickly in current architecture.
- **Reliability:** ingestion remains unaffected by weather API instability.
- **Scalability:** queue model supports growing users.
- **Scientific honesty:** data is useful and transparent, without overclaiming precision.

## Implementation Checklist

### Phase 0 - Setup and guardrails

- [ ] Confirm branch name for implementation (`weather-enrichment-v1` recommended).
- [ ] Add environment variables:
  - [ ] `WEATHER_PROVIDER`
  - [ ] `WEATHER_ENRICHMENT_CRON_SECRET`
  - [ ] provider API key(s) only if required by chosen provider.
- [ ] Define service-level targets:
  - [ ] enrichment within 10 minutes
  - [ ] max retry attempts (recommended: 3)
  - [ ] acceptable failure rate threshold.

### Phase 1 - Database and schema

- [ ] Add enums in `src/server/db/schema.ts`:
  - [ ] `weather_enrichment_status` (`PENDING | OK | FAILED | NEEDS_REVIEW`)
  - [ ] `weather_quality_flag` (`UNKNOWN | PLAUSIBLE | SUSPECT`)
- [ ] Add `report_weather` table in `src/server/db/schema.ts` with agreed columns.
- [ ] Add indexes:
  - [ ] unique(`report_id`)
  - [ ] index(`status`, `next_retry_at`)
  - [ ] index(`org_id`, `observed_at` desc)
  - [ ] index(`grid_key`, `observed_local_date`)
  - [ ] index(`quality_flag`, `status`)
- [ ] Generate and apply drizzle migration.
- [ ] Validate migration on staging-like dataset.

### Phase 2 - Ingestion hook (non-blocking)

- [ ] Update `src/server/modules/whatsapp-bot/workflow-processor.ts`:
  - [ ] after report insert, parse location
  - [ ] if valid lat/lon, create `report_weather` row with `PENDING`
  - [ ] compute and store `observed_local_date` + `timezone` (`Africa/Harare`)
  - [ ] do not block/fail report creation if weather row insert fails (log only).

### Phase 3 - Weather service module

- [ ] Create `src/server/modules/weather/weather-service.ts` with:
  - [ ] `computeGridKey(lat, lon, observedLocalDate)`
  - [ ] `fetchProviderDailyWeather(...)`
  - [ ] `computeRain7d(...)`
  - [ ] `validateWeatherHeuristics(...)`
  - [ ] `enrichReportWeather(reportWeatherId)`
- [ ] Create provider adapter interface:
  - [ ] `src/server/modules/weather/providers/types.ts`
  - [ ] `src/server/modules/weather/providers/<primary-provider>.ts`
- [ ] Include robust error normalization (`error_code` mapping).
- [ ] Persist `source`, `provider_version`, optional `provider_payload`.

### Phase 4 - Cron worker

- [ ] Add route `src/app/api/cron/weather-enrichment/route.ts`.
- [ ] Protect route with `WEATHER_ENRICHMENT_CRON_SECRET`.
- [ ] Select pending rows safely:
  - [ ] only rows due for retry (`next_retry_at <= now`)
  - [ ] lock rows to avoid duplicate processing
  - [ ] process in batch size 25-50.
- [ ] Implement retry/backoff policy:
  - [ ] increment `attempt_count`
  - [ ] set `next_retry_at`
  - [ ] mark `FAILED` after max attempts.
- [ ] Mark suspect records as `NEEDS_REVIEW`.

### Phase 5 - Read APIs and UI

- [ ] Join `report_weather` data in report detail queries:
  - [ ] `src/server/modules/triage/triage-service.ts`
  - [ ] `src/server/modules/analytics/analytics-service.ts` (where needed)
- [ ] Update UI report detail:
  - [ ] `src/app/dashboard/triage/_components/report-detail.tsx`
  - [ ] show rainfall + temperature + source + fetched time
  - [ ] show status badge (`Pending`, `Estimated`, `Needs Review`, `Unavailable`)
  - [ ] weather failure must not break report rendering.

### Phase 6 - Backfill

- [ ] Add route `src/app/api/cron/weather-backfill/route.ts`.
- [ ] Input filters: `orgId`, `from`, `to`, `limit`.
- [ ] Insert `PENDING` rows only for reports with valid location and no weather row.
- [ ] Run oldest-first batch mode with rate limits.

### Phase 7 - Observability and operations

- [ ] Add structured logs with `report_id`, `grid_key`, `status`, `error_code`.
- [ ] Add lightweight health metrics:
  - [ ] pending queue size
  - [ ] oldest pending age
  - [ ] success/failure counts
  - [ ] suspect count.
- [ ] Add runbook notes for retry spikes/provider outages.

### Phase 8 - Testing and acceptance

- [ ] Unit tests:
  - [ ] grid key computation
  - [ ] observed local date conversion
  - [ ] quality heuristics
  - [ ] retry backoff logic.
- [ ] Integration tests:
  - [ ] report creation creates `PENDING` row
  - [ ] cron processes pending to `OK`
  - [ ] failure path retries then `FAILED`
  - [ ] suspect path sets `NEEDS_REVIEW`.
- [ ] Manual UAT checklist:
  - [ ] report visible immediately without weather
  - [ ] weather appears after cron
  - [ ] dashboard still usable during provider outage.

### Release gates

- [ ] Gate 1: schema + ingestion hook deployed safely.
- [ ] Gate 2: cron enrichment active for one pilot org.
- [ ] Gate 3: UI weather card enabled for pilot users.
- [ ] Gate 4: backfill completed and metrics within target.
