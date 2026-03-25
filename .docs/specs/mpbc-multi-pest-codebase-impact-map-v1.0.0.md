# MPBC Multi-Pest Codebase Impact Map
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** March 25, 2026  
**Depends On:** accepted scope lock, schema/domain proposal

## 1. Purpose
This document maps the approved multi-pest design onto the current codebase so implementation can proceed in a deliberate order.

It identifies:

- which files are directly affected
- what kind of change each file needs
- which areas can evolve in place
- which areas should be replaced or bypassed for MPBC

## 2. Current Architecture Summary
The current MPBC implementation is spread across five major areas:

1. database schema and report storage
2. WhatsApp runtime and workflow config
3. alert threshold logic
4. admin settings UI
5. reporting, triage, and PDF output

The strongest existing reusable pieces are:

- `reports.dataPayload`
- `reports.severity`
- `report_weather`
- report listing and filtering surfaces
- location and province analytics

The most MPBC-specific assumptions that now need to change are:

- single embedded workflow config on `organizations`
- one-pest trap-first runtime
- count-only severity logic in `alerts-service`
- threshold-settings UI that assumes contiguous numeric bands per pest
- PDF/report copy that still assumes trap monitoring

## 3. Impact By Area
### 3.1 Database and Persistence
Primary files:

- `src/server/db/schema.ts`

What changes:

- add new enums for observation methods, alert triggers, field types, and rule condition kinds
- add new tables for:
  - `pest_configurations`
  - `pest_observation_configs`
  - `pest_observation_fields`
  - `pest_severity_rules`
- extend `reports` with:
  - `pest_configuration_id`
  - `pest_key`
  - `observation_method`
  - `alert_triggered`
  - `alert_trigger_reason`
- add relations for the new tables

What stays:

- `report_weather`
- `report_media`
- `triage_enhancements`
- existing `reports.dataPayload`

Migration note:

- `org_alert_thresholds` should remain temporarily for compatibility, but it should stop being the primary MPBC logic source

### 3.2 Seed Data and Configuration Bootstrapping
Primary files:

- `scripts/whatsapp-bot-seed-workflows.ts`

What changes:

- stop treating MPBC as a single embedded workflow JSON definition
- either replace this script or split MPBC seeding into a new pest-config seeding script
- seed the accepted phase-1 pests:
  - African Armyworm
  - Locusts
  - Quelea Birds
  - Rodents
  - Whiteflies

Recommended direction:

- keep this script for legacy org workflow seeding if needed
- create a dedicated MPBC pest configuration seed path rather than overloading the old `workflowConfig` shape

### 3.3 WhatsApp Entry and Session Routing
Primary files:

- `src/app/api/webhooks/whatsapp/route.ts`
- `src/server/modules/whatsapp-bot/workflow.ts`
- `src/server/modules/whatsapp-bot/workflow-processor.ts`
- `src/server/modules/whatsapp-bot/workflow-types.ts`
- `src/app/api/dev/whatsapp-simulate/route.ts`
- `src/server/modules/whatsapp-bot/README.md`

What changes:

- `workflow.ts`
  - detect MPBC orgs that should use pest configuration runtime instead of `organizations.workflowConfig`
- `workflow-processor.ts`
  - biggest runtime refactor area
  - replace count-centric and step-array-centric assumptions for MPBC
  - support:
    - pest selection
    - optional observation-method selection
    - dynamic field prompting
    - derived value computation
    - rule-based severity evaluation
    - alert trigger evaluation
  - persist normalized `dataPayload`
- `workflow-types.ts`
  - either preserve as legacy types or stop using it for MPBC
  - add new MPBC-specific runtime types from pest config tables
- `whatsapp-simulate/route.ts`
  - update test/dev simulation to run against pest-config runtime
- `README.md`
  - terminology cleanup
  - remove Fall Armyworm baseline wording
  - document new runtime model

Recommended direction:

- do not force the new MPBC model into the old generic step array without abstraction
- create a dedicated MPBC runtime layer that builds prompts from pest config records

### 3.4 Alert Evaluation and Config Loading
Primary files:

- `src/server/modules/alerts/alerts-service.ts`
- `src/server/api/routers/alerts.ts`

What changes:

- `alerts-service.ts`
  - evolve from threshold-table service into a general pest evaluation service
  - responsibilities should become:
    - load pest config
    - compute derived values
    - evaluate severity rules
    - evaluate alert trigger
    - return severity plus alert outcome and source
- `alerts.ts`
  - current endpoints are threshold-specific
  - these will either need:
    - replacement with pest configuration CRUD endpoints
    - or coexistence during transition

Recommended direction:

- keep the existing thresholds endpoints only as migration support
- add a new config-oriented API surface instead of stretching the threshold API beyond recognition

### 3.5 Admin Settings and Configuration UI
Primary files:

- `src/app/dashboard/settings/alerts/page.tsx`
- `src/app/dashboard/settings/alerts/_components/alert-thresholds-table.tsx`
- `src/app/dashboard/_components/nav-items.ts`

What changes:

- the current page is explicitly built for `normalMax / warningMax`
- the current table only supports:
  - pest name
  - normal max
  - warning max
  - severity preview
- this page is too narrow for the new model

Recommended direction:

- replace `Alert Settings` with a broader `Pest Configurations` area
- update nav to point to the new settings surface
- preserve the current alerts page only temporarily if needed during migration

New UI capability required:

- pest list view
- create/edit pest configuration
- method management
- field management
- severity rule management
- alert trigger selection
- officer prompt preview

### 3.6 Reports API and Report Aggregation
Primary files:

- `src/server/api/routers/reports.ts`
- `src/server/modules/reports/report-service.ts`
- `src/server/modules/reports/report-types.ts`
- `src/server/modules/triage/triage-service.ts`

What changes:

- `reports.ts`
  - report generation naming and metadata should become pest-neutral where needed
- `report-service.ts`
  - stop assuming the important metric is always trap count
  - include:
    - `pest_key`
    - `observation_method`
    - derived metrics where useful
    - alert-trigger outcome
  - maintain backward compatibility for old reports
- `report-types.ts`
  - extend report output types to expose new fields
- `triage-service.ts`
  - ensure report fetches include the new report fields and possibly pest-config relations if needed later

Recommended direction:

- evolve reporting in place
- keep old fields as fallbacks while gradually shifting frontends to use explicit pest and method metadata

### 3.7 Reports Page and Dashboard UI
Primary files:

- `src/app/dashboard/reports/page.tsx`
- `src/app/dashboard/reports/_components/filter-bar.tsx`
- `src/app/dashboard/reports/_components/grouped-view.tsx`
- `src/app/dashboard/reports/_components/list-view.tsx`
- `src/app/dashboard/reports/_components/location-detail.tsx`
- `src/app/dashboard/_components/province-breakdown.tsx`
- `src/app/dashboard/_components/pest-distribution.tsx`
- `src/app/dashboard/_components/dashboard-map.tsx`
- `src/app/dashboard/triage/_components/report-detail.tsx`
- `src/app/dashboard/triage/_components/reports-list.tsx`

What changes:

- add observation-method display where appropriate
- add support for method-aware summary values instead of only `observedCount`
- expose structured fields from `dataPayload.raw`, `dataPayload.derived`, and `dataPayload.context`
- keep current severity badges and location patterns
- keep pest filtering, but migrate to `pest_key` or normalized pest label where possible

Recommended direction:

- do not redesign these pages from scratch
- incrementally enrich them with:
  - pest method
  - richer structured observation details
  - cleaner mixed-pest wording

### 3.8 MPBC PDF Rendering
Primary files:

- `src/server/modules/reports/mpbc-report-pdf-renderer.ts`

What changes:

- current renderer is still explicitly trap-focused:
  - `Weekly Trap Monitoring Report`
  - `African Armyworm Surveillance`
  - `High Alert Trap Observations`
- province and summary sections assume trap-first semantics

Recommended direction:

- update wording to mixed-pest language
- make summary tables able to render:
  - pest
  - observation method
  - primary summary value
  - severity
- avoid assuming all reports have a single trap count column

### 3.9 Analytics Layer
Primary files:

- `src/server/api/routers/analytics.ts`
- `src/server/modules/analytics/analytics-service.ts`

Why included:

- reports page consumes analytics endpoints for grouped and list data
- pest filtering and grouped summaries may still be reading from legacy fields

What changes:

- update analytics payloads to carry:
  - normalized pest key or label
  - observation method
  - method-aware summary fields
- ensure search and filters stay correct when data comes from richer `dataPayload`

## 4. Change Classification
### 4.1 Files To Modify In Place
- `src/server/db/schema.ts`
- `src/server/modules/alerts/alerts-service.ts`
- `src/server/modules/whatsapp-bot/workflow.ts`
- `src/server/modules/whatsapp-bot/workflow-processor.ts`
- `src/server/api/routers/reports.ts`
- `src/server/modules/reports/report-service.ts`
- `src/server/modules/reports/report-types.ts`
- `src/server/modules/reports/mpbc-report-pdf-renderer.ts`
- `src/server/modules/triage/triage-service.ts`
- `src/app/dashboard/reports/page.tsx`
- `src/app/dashboard/triage/_components/report-detail.tsx`
- `src/app/dashboard/_components/nav-items.ts`

### 4.2 Files Likely To Be Replaced Or Superseded
- `src/app/dashboard/settings/alerts/page.tsx`
- `src/app/dashboard/settings/alerts/_components/alert-thresholds-table.tsx`
- `scripts/whatsapp-bot-seed-workflows.ts` for MPBC-specific seeding
- `src/server/modules/whatsapp-bot/workflow-types.ts` for MPBC runtime usage

### 4.3 New Files Likely Needed
Recommended new modules:

- pest config service
- pest config seed script
- MPBC runtime config loader
- MPBC severity evaluator
- MPBC admin router
- MPBC admin pages/components under dashboard settings

## 5. Recommended Implementation Order By Code Area
1. `schema.ts` and migrations
2. pest config seed path
3. pest config loader and evaluator service
4. MPBC WhatsApp runtime refactor
5. config management API
6. admin configuration UI
7. reports and analytics enrichment
8. PDF/export alignment

## 6. Risks By Area
### 6.1 Schema Risk
- over-normalizing too early could slow delivery

Mitigation:

- keep options and derived definitions in JSON in phase 1

### 6.2 Runtime Risk
- trying to shoehorn MPBC into the legacy step-array model may create brittle logic

Mitigation:

- introduce an MPBC-specific runtime path rather than over-generalizing prematurely

### 6.3 UI Risk
- replacing threshold settings with full pest config UI is a larger jump than a small form tweak

Mitigation:

- build the UI around read/write config records, not around old threshold concepts

### 6.4 Reporting Risk
- some existing reports and dashboard cards assume `observedCount` is always the main value

Mitigation:

- keep `observedCount` as a convenience field where meaningful
- use structured payload summaries for non-count methods

## 7. Immediate Next Engineering Move
The next concrete step after this impact map should be:

1. implement the schema changes in `src/server/db/schema.ts`
2. add the new MPBC config seed path
3. scaffold the pest config and evaluation service before touching the WhatsApp runtime
