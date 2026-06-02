# MPBC Multi-Pest Schema and Domain Proposal
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** March 25, 2026  
**Depends On:** v2.1 multi-pest config spec, accepted scope-lock note

## 1. Purpose
This document translates the accepted multi-pest scope into an implementation-facing persistence and domain model that fits the current codebase.

It is intentionally pragmatic:

- preserve what already works
- avoid rewriting unrelated reporting infrastructure
- introduce new config tables where the current embedded workflow model is too rigid
- keep reports flexible enough for future observation-method expansion

## 2. Current-State Constraints In The Repo
Current codebase observations:

- organization workflow configuration is embedded in `organizations.workflowConfig`
- WhatsApp flow is driven by generic `WorkflowConfig.steps`
- report ingestion stores structured answers in `reports.dataPayload`
- top-level report indexing currently relies on `reports.label`, `reports.observedCount`, `reports.severity`, and `reports.severitySource`
- alerting is currently driven by `org_alert_thresholds`
- `org_alert_thresholds` assumes one contiguous numeric threshold model per pest
- weather enrichment is already separated into `report_weather` and can remain independent

Implication:

- we should not try to replace `reports.dataPayload`
- we should replace the current embedded MPBC workflow config and per-pest threshold model with first-class pest configuration tables
- we should add a reusable evaluation layer that computes severity from method-specific rules instead of directly from count thresholds

## 3. Design Goals
- Support org-specific pest configurations
- Support one or more observation methods per pest
- Support typed method-specific fields
- Support derived values
- Support method-aware severity rules
- Keep alert trigger separate from severity computation
- Preserve backward compatibility for reporting and historical reports where possible

## 4. Recommended Domain Model
### 4.1 Keep These Existing Tables
Keep and continue using:

- `organizations`
- `app_users`
- `reports`
- `bot_sessions`
- `report_weather`
- `report_media`
- `triage_enhancements`

### 4.2 Replace or De-emphasize These Existing Concepts
- De-emphasize `organizations.activeWorkflow` and `organizations.workflowConfig` for MPBC once the new config runtime is live
- Replace `org_alert_thresholds` as the primary source of severity logic for MPBC

### 4.3 Introduce These New Core Concepts
- `pest_configurations`
- `pest_observation_configs`
- `pest_observation_fields`
- `pest_severity_rules`
- optional `pest_field_options` if select options should be normalized relationally

## 5. Proposed Table Design
### 5.1 `pest_configurations`
One row per pest per organization.

Purpose:

- identify which pests are available in an org
- store pest-level display and policy settings

Suggested columns:

- `id`
- `org_id`
- `key`
- `label`
- `active`
- `display_order`
- `default_observation_method`
- `alert_trigger`
- `created_at`
- `updated_at`

Suggested constraints:

- unique on `(org_id, key)`
- index on `(org_id, active, display_order)`

Notes:

- `key` should be stable and machine-friendly, for example `african_armyworm`
- `label` is officer-facing and report-facing, for example `African Armyworm`
- `alert_trigger` lives at pest level in phase 1 because the accepted scope gives each pest one primary method

### 5.2 `pest_observation_configs`
One row per observation method supported by a pest configuration.

Purpose:

- define which methods the pest supports
- define whether a method is active
- attach method-level guidance and confirmation copy if needed

Suggested columns:

- `id`
- `pest_configuration_id`
- `method`
- `active`
- `display_order`
- `count_field_key` nullable
- `summary_field_keys` jsonb nullable
- `guidance_text` nullable
- `confirmation_normal_template` nullable
- `confirmation_warning_template` nullable
- `confirmation_high_template` nullable
- `created_at`
- `updated_at`

Suggested constraints:

- unique on `(pest_configuration_id, method)`

Notes:

- `count_field_key` identifies the raw field that should populate `reports.observedCount` when a method still has a useful numeric primary value
- `summary_field_keys` lets the runtime and dashboards know which method fields matter most for compact display

### 5.3 `pest_observation_fields`
One row per field in a method-specific officer flow.

Purpose:

- define the method-specific input schema and prompt behavior

Suggested columns:

- `id`
- `observation_config_id`
- `key`
- `label`
- `prompt`
- `help_text` nullable
- `field_type`
- `required`
- `display_order`
- `default_value` jsonb nullable
- `options` jsonb nullable
- `validation_rules` jsonb nullable
- `capture_mode` default `RAW`
- `created_at`
- `updated_at`

Suggested enum values:

- `field_type`: `number`, `select`, `boolean`, `text`
- `capture_mode`: `RAW`, `CONTEXT`

Suggested validation shape inside `validation_rules`:

```json
{
  "min": 0,
  "max": 100,
  "maxFieldRef": "plants_sampled"
}
```

Notes:

- `options` can be stored in JSON in phase 1 to keep implementation simple
- this avoids the overhead of a separate options table unless admin editing later requires it

### 5.4 `pest_severity_rules`
One row per severity rule for a method.

Purpose:

- define how method-specific observations map to `NORMAL`, `WARNING`, or `HIGH`

Suggested columns:

- `id`
- `observation_config_id`
- `rule_order`
- `severity`
- `condition_kind`
- `condition_expression`
- `created_at`
- `updated_at`

Suggested enum values:

- `severity`: existing `severityEnum`
- `condition_kind`: `NUMERIC`, `DERIVED`, `CATEGORICAL`, `DEFAULT`

Notes:

- phase 1 can evaluate rules in order, first match wins
- `condition_expression` may be JSON-backed or string-backed depending on implementation preference

Recommended storage shape for `condition_expression`:

```json
{
  "field": "moth_count",
  "operator": ">",
  "value": 20
}
```

or

```json
{
  "field": "activity_level",
  "operator": "=",
  "value": "HIGH"
}
```

This is safer than storing arbitrary free-form formulas in the database in phase 1.

### 5.5 Derived Values Strategy
Do not create a dedicated derived-values table in phase 1.

Recommended approach:

- define derived formulas in `pest_observation_configs` as JSON
- compute derived values at runtime
- persist derived values into `reports.dataPayload.derived`

Suggested column addition on `pest_observation_configs`:

- `derived_definitions` jsonb nullable

Example:

```json
{
  "infestation_rate": {
    "formula": "ratio",
    "numeratorField": "plants_infested",
    "denominatorField": "plants_sampled"
  }
}
```

Reason:

- derived-value logic is still small in phase 1
- storing it at method level keeps schema simpler

## 6. Proposed Changes To `reports`
Do not replace the `reports` table. Extend it.

### 6.1 Keep Existing Useful Columns
Keep:

- `label`
- `dataPayload`
- `observedCount`
- `severity`
- `severitySource`
- `location`
- `mediaUrl`

### 6.2 Add These New Columns
Suggested additions:

- `pest_configuration_id` nullable initially
- `pest_key` nullable initially
- `observation_method` nullable initially
- `alert_triggered` boolean nullable
- `alert_trigger_reason` text nullable

Why:

- `pest_key` and `observation_method` become first-class report dimensions
- `pest_configuration_id` preserves linkage to the config version used at ingestion time
- `alert_triggered` separates alert outcome from severity

### 6.3 Recommended `dataPayload` Shape
Continue storing raw answers in `dataPayload`, but normalize the structure.

Suggested shape:

```json
{
  "raw": {
    "moth_count": 18,
    "trap_functional": true
  },
  "derived": {},
  "context": {
    "field_conditions": "Windy"
  },
  "meta": {
    "pestKey": "african_armyworm",
    "pestLabel": "African Armyworm",
    "observationMethod": "PHEROMONE_TRAP"
  }
}
```

Reason:

- keeps historical compatibility with JSON payload storage
- gives a cleaner contract for reporting and runtime code

## 7. Recommended Enum Additions
Add enums in [schema.ts](c:/Users/User/Documents/Aaki%20Tech/Agridata-AI/agridata-ai/src/server/db/schema.ts):

- `observationMethodEnum`
  - `PHEROMONE_TRAP`
  - `FIELD_OBSERVATION`
  - `EVENT_OBSERVATION`
  - `SIGN_BASED`

- `alertTriggerEnum`
  - `WARNING_AND_HIGH`
  - `HIGH_ONLY`
  - `NONE`

- `fieldTypeEnum`
  - `number`
  - `select`
  - `boolean`
  - `text`

- `ruleConditionKindEnum`
  - `NUMERIC`
  - `DERIVED`
  - `CATEGORICAL`
  - `DEFAULT`

Consider extending `severitySourceEnum` later if MPBC starts distinguishing:

- `PEST_RULE`
- `LEGACY_THRESHOLD`
- `DEFAULT_FALLBACK`

## 8. Backward Compatibility Strategy
### 8.1 Existing Historical Reports
Historical reports should continue to work without backfill.

Approach:

- keep using `reports.label` as a display fallback
- keep using `reports.observedCount` where present
- preserve legacy `dataPayload`
- treat missing `pest_key` and `observation_method` as legacy records

### 8.2 Existing Alert Thresholds
`org_alert_thresholds` can remain temporarily during migration.

Recommended phase-1 approach:

- new MPBC ingestion should use pest configuration rules
- old alert settings UI can continue to read `org_alert_thresholds` until replaced
- once MPBC admin configuration is live, `org_alert_thresholds` should be deprecated for MPBC flows

## 9. Runtime Domain Types
Recommended TypeScript domain shape:

```ts
type PestConfigRecord = {
  id: string;
  orgId: string;
  key: string;
  label: string;
  active: boolean;
  displayOrder: number;
  defaultObservationMethod: ObservationMethod;
  alertTrigger: AlertTrigger;
  observationConfigs: ObservationConfigRecord[];
};

type ObservationConfigRecord = {
  id: string;
  pestConfigurationId: string;
  method: ObservationMethod;
  active: boolean;
  countFieldKey?: string | null;
  guidanceText?: string | null;
  derivedDefinitions?: Record<string, unknown> | null;
  fields: ObservationFieldRecord[];
  severityRules: SeverityRuleRecord[];
};
```

This should live outside the old generic `WorkflowConfig` path and become the source for MPBC runtime orchestration.

## 10. How This Maps To The Current Code
### 10.1 `organizations.workflowConfig`
Current role:

- stores embedded workflow JSON for the org

Recommended future role:

- leave in place for non-MPBC or legacy flows
- stop using it as the primary MPBC source once pest config tables exist

### 10.2 `workflow-types.ts`
Current role:

- generic step-based runtime model

Recommended future role:

- retain as legacy support if needed
- introduce MPBC-specific runtime types built from pest config tables

### 10.3 `alerts-service.ts`
Current role:

- pest plus count threshold evaluation

Recommended future role:

- evolve into a more general evaluation service that:
  - loads pest config
  - computes derived values
  - evaluates severity rules
  - evaluates alert trigger policy

### 10.4 `workflow-processor.ts`
Current role:

- reads `WorkflowConfig.steps`
- computes severity from `count`
- saves report payload

Recommended future role:

- branch MPBC processing onto pest configuration runtime
- preserve generic processor only for legacy or non-MPBC flows if still needed

## 11. Recommended Seed Shape For Phase 1
Seed five pest configs for MPBC:

- African Armyworm / `PHEROMONE_TRAP`
- Locusts / `EVENT_OBSERVATION`
- Quelea Birds / `EVENT_OBSERVATION`
- Rodents / `SIGN_BASED`
- Whiteflies / `FIELD_OBSERVATION`

Each seed should include:

- pest identity
- active flag
- display order
- default method
- method-specific fields
- severity rules
- alert trigger

## 12. Recommended Migration Sequence
1. Add new enums and tables
2. Add new nullable columns to `reports`
3. Seed MPBC pest configurations
4. Build config loader and evaluator service
5. Switch MPBC WhatsApp ingestion to the new runtime
6. Backfill new report columns for fresh reports only
7. Deprecate `org_alert_thresholds` for MPBC admin flows

## 13. Decisions In This Proposal
Recommended decisions:

- store select options in JSON in phase 1
- store derived definitions in JSON in phase 1
- store severity conditions in structured JSON rather than arbitrary formulas
- keep `reports.dataPayload` as the canonical observation payload container
- extend `reports` for indexing and filtering rather than creating a separate observations table in phase 1

## 14. Deferred For Later
- global pest templates across organizations
- full config versioning and audit history
- a dedicated normalized observations fact table
- method-specific alert triggers if future pests require that granularity
- African Armyworm field observation mode

## 15. Recommended Next Step
After this proposal is accepted, the next artifact should be a codebase impact map that names the exact files and modules to change in:

- database schema and migrations
- seed scripts
- WhatsApp runtime
- alerts/evaluation logic
- admin UI
- reports and exports
