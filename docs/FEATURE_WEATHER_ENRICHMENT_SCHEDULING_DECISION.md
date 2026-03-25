# Weather Enrichment Scheduling Decision (MVP vs Long-Run)

## Context

Weather enrichment implementation in code today:
- Report ingestion creates `report_weather` rows with `PENDING` status.
- `/api/cron/weather-enrichment` processes pending rows in batches.
- `/api/cron/weather-finalize` revisits provisional rows.
- `/api/cron/weather-backfill` queues historical rows on demand.

Constraint observed on deployment:
- Vercel Hobby supports only daily cron frequency, so `*/5` and `*/10` schedules are not available on Hobby.

## Decision We Are Making

### Phase 1 (Now): Azure Pipelines Scheduled HTTP Triggers (Chosen MVP)
Use Azure DevOps scheduled pipelines to call:
- `GET /api/cron/weather-enrichment?batchSize=...` every 10 minutes
- `GET /api/cron/weather-finalize?batchSize=...` daily (or every 6-12h)
- `GET /api/cron/weather-backfill?limit=...` manually when needed

Auth is via `x-cron-secret`/Bearer secret.

### Phase 2 (Near-Term Upgrade): Vercel Pro Cron
When budget and ops preference allow, move schedule ownership to `vercel.json` cron on Pro plan and retire Azure scheduler jobs for enrichment/finalize.

### Phase 3 (Long-Run Ideal): Event-Driven Queue Worker
Move to job-per-report processing at ingestion time (queue + worker), and keep cron only for sweep/retry/finalize/backfill.

## Options and Tradeoffs

## Option A: Azure Pipelines Scheduler -> Vercel Endpoints (MVP)

### Pros
1. No immediate Vercel Pro cost.
2. Works with your current Azure DevOps operating model.
3. Keeps ingestion non-blocking and resilient.
4. Minimal incremental code changes.

### Cons
1. Two control planes to manage (Azure + Vercel).
2. More operational wiring and secrets handling.
3. Possible scheduling drift or missed runs if pipeline scheduling fails.

### Reliability / Speed / Cost
- Reliability: Medium-High (good if monitored)
- Speed: High enough for pilot (5-10 minute freshness)
- Cost: Low-Medium

## Option B: Vercel Pro Cron (Single-Platform Scheduled Polling)

### Pros
1. Simpler operations (one platform).
2. Fewer moving parts and less scheduler glue code.
3. Clear ownership of deployment + scheduling in Vercel.

### Cons
1. Paid plan required.
2. Still polling-based, not true event-driven real-time.
3. Runtime limits still apply per invocation.

### Reliability / Speed / Cost
- Reliability: Medium-High
- Speed: High (5-10 minute freshness)
- Cost: Medium (plan upgrade)

## Option C: Event-Driven Queue + Worker (Ideal Long-Run Architecture)

### Pros
1. Best latency (near-immediate enrichment after report creation).
2. Stronger retry semantics and failure isolation.
3. Better scale behavior as usage grows 3x+.
4. Cleaner operational model for backlog control.

### Cons
1. Highest implementation complexity.
2. Requires queue/worker observability and ownership.
3. More infra decisions and migration effort.

### Reliability / Speed / Cost
- Reliability: High
- Speed: Very High (near-real-time)
- Cost: Medium (depends on queue/worker design)

## Option D: Inline Enrichment in Ingestion (Not Recommended)

### Pros
1. Immediate weather on save.
2. No external scheduler required.

### Cons
1. User-facing ingestion latency increases.
2. Provider instability can affect report submission path.
3. Harder to operate safely at scale.

## Why MVP Choice Is Good

1. It preserves product UX: no extra WhatsApp questions and no blocking ingestion.
2. It delivers weather quickly enough for daily operational triage.
3. It avoids paying for Pro immediately while still supporting frequent runs.
4. It de-risks launch by using already-adopted Azure pipeline tooling.

## MVP Shortcomings (Explicit)

1. Not true real-time; weather appears on schedule cadence.
2. Operationally more complex than single-platform scheduling.
3. Requires active monitoring of scheduler health and backlog.
4. Polling can do unnecessary work compared to event-driven jobs.

## Ideal Architecture (Long-Run)

1. Ingestion writes report and emits enrichment job immediately.
2. Worker fetches weather and updates `report_weather` in seconds/minutes.
3. Scheduled sweeps handle retries, provisional finalization, and backfill.
4. Dashboard always shows source + observed date + provisional flag for trust.

## Operating Triggers to Move Between Phases

Move from Phase 1 -> Phase 2 (Azure -> Vercel Pro) when:
1. Team wants single-platform operations.
2. Cost of Pro is lower than cross-platform scheduler overhead.

Move from Phase 2 -> Phase 3 (Pro cron -> event-driven) when:
1. Freshness requirement tightens to near-immediate.
2. Backlog or volume growth makes polling inefficient.
3. Reliability/latency SLOs require deterministic job execution.

## Minimal MVP Schedule Recommendation (Current)

1. `weather-enrichment`: every 10 minutes, `batchSize=25-50`.
2. `weather-finalize`: daily (or every 6-12 hours if needed).
3. `weather-backfill`: manual, controlled windows only.

## Notes for Pilot Expectations

- For pilot users, this architecture is operationally acceptable: weather appears shortly after report ingestion, not instantly.
- If stakeholders require near-instant visibility, move to queue-based event-driven enrichment rather than increasing cron frequency alone.
