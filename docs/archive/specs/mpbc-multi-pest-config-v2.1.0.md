# MPBC Multi-Pest Configuration System Specification
**Version:** 2.1.0  
**Status:** Draft  
**Last Updated:** March 25, 2026  
**Context:** Refinement of the MPBC multi-pest configuration model after cofounder review of officer questionnaire feedback and the v2.1 planning spec.

## 1. Overview
This document refines the earlier v1 multi-pest proposal into a more implementation-ready product and technical direction for MPBC.

The core goal remains unchanged: move MPBC from a hardcoded African Armyworm reporting flow to a configuration-driven multi-pest surveillance system.

The key refinement in v2.1 is that pests must not be modeled as a single shared count workflow with cosmetic wording changes. Different pests use different observation methods, produce different kinds of signals, and require different field inputs. The system must capture raw observations and derive severity, alerting, and trend interpretation from configuration and system logic.

## 2. What Changed From v1
The v1 draft correctly established the need for configuration-driven pest workflows, pest-specific prompts, and separation between severity and alert triggering.

The v2.1 refinement adds five major decisions:

- Raw observation data should be captured instead of officer interpretation labels such as `high risk`, `warning`, or `outbreak`
- `Observation method` is now a first-class concept in the model
- A pest may support more than one observation method
- Field definitions, derived metrics, and severity rules should be attached to the observation method, not only to the pest
- Weather should be primarily system-enriched, with only lightweight field-condition prompts where needed

## 3. Product Intent
MPBC needs one reporting entry point that can support multiple pests without rewriting the WhatsApp flow every time a new pest is onboarded.

That entry point should allow the system to:

- present the active pest list
- optionally present an observation-method choice when a pest supports multiple methods
- ask only the structured fields needed for that pest and method
- derive severity from configured logic
- raise alerts according to a separate alert trigger policy
- preserve structured data for reporting, analytics, and future forecasting

## 4. Core Principles
- Capture what officers observe, not what they think it means
- Configuration over hardcoded branching
- Observation method determines data shape
- Severity is computed, not asked
- Alerts are policy, not severity itself
- Keep officer flows short, structured, and pest-aware
- Preserve African Armyworm as the current baseline while allowing validated extension

## 5. Domain Findings Incorporated in v2.1
The officer feedback and cofounder review reinforce the following:

- Monitoring is officer-pest-specific, not one shared universal reporting pattern
- Different pests require different observation methods and different data structures
- Subjective labels such as `few`, `many`, `warning`, `high risk`, or `outbreak` should be removed where the system can infer meaning from raw inputs
- Sampling matters for some pests and should be explicitly captured where operationally appropriate
- Not all pests fit a pure numeric count model
- Some pests are event-based or sign-based rather than trap-based

## 6. Pest Scope
The current in-scope pest set remains:

- African Armyworm
- Locusts
- Quelea Birds
- Rodents
- Fall Armyworm

Future pests already hinted at in feedback, but not in scope for this implementation phase:

- Whiteflies
- Armoured Cricket
- Aphids or Mealybugs

## 7. Observation Model
### 7.1 New First-Class Concept
Observation method must be modeled explicitly.

Suggested enum:

```ts
type ObservationMethod =
  | "PHEROMONE_TRAP"
  | "FIELD_OBSERVATION"
  | "EVENT_OBSERVATION"
  | "SIGN_BASED";
```

Interpretation:

- `PHEROMONE_TRAP`: trap-based count workflow
- `FIELD_OBSERVATION`: sampled or direct field observation workflow
- `EVENT_OBSERVATION`: event-based reporting such as swarms or flocks
- `SIGN_BASED`: indirect signs, traces, or activity signals such as rodents

### 7.2 Why This Matters
Different methods produce fundamentally different data:

- African Armyworm trap monitoring produces numeric trap counts
- African Armyworm field scouting may produce sampled infestation values
- Locust reporting may emphasize swarm size, movement, and behavior
- Quelea reporting may emphasize flock size, crop stage, behavior, and area affected
- Rodent reporting may emphasize signs, activity level, trend, and damage type

These should not be forced into one shared `observedCount + unit` shape.

### 7.3 Pest-to-Method Support
Each pest configuration must define:

- `supportedObservationMethods`
- `defaultObservationMethod`

If a pest supports only one method, WhatsApp should skip the method-selection step.

If a pest supports multiple methods, WhatsApp should ask the officer which observation method they are using.

## 8. Structured Field Model
### 8.1 Field Shape
Each observation method defines its own field list.

Suggested conceptual shape:

```ts
type PestField = {
  key: string;
  label: string;
  type: "number" | "select" | "boolean" | "text";
  required: boolean;
  options?: string[];
  default?: string | number | boolean;
  prompt: string;
  helpText?: string;
};
```

### 8.2 Field Design Rules
- Prefer numeric input or defined ranges over vague labels
- Use `select` for standardized options such as crop stage or movement behavior
- Use `boolean` for clear binary checks such as `trap_functional`
- Use `text` sparingly, mainly for contextual notes that cannot be standardized yet
- Keep `Not sure` only where uncertainty is operationally realistic

### 8.3 Derived Values
Some important values should be computed from raw inputs, not asked directly.

Example:

```ts
derived: {
  infestation_rate: "plants_infested / plants_sampled";
}
```

This supports future reporting, trend analysis, and forecasting without asking officers to do calculations manually.

## 9. Severity and Alert Model
### 9.1 Severity
Severity remains a system-computed outcome:

- `NORMAL`
- `WARNING`
- `HIGH`

Severity must not be asked directly in the officer flow.

### 9.2 Severity Rules
Severity rules should be defined at the observation-method level because different methods for the same pest may require different logic.

Suggested conceptual shape:

```ts
severityRules: {
  condition: string;
  severity: "NORMAL" | "WARNING" | "HIGH";
}[]
```

This must support:

- numeric conditions
- derived-value conditions
- categorical conditions where justified

Examples:

- `moth_count > 20 => HIGH`
- `infestation_rate > 0.2 => HIGH`
- `flock_size_band == "20000_PLUS" => HIGH`

### 9.3 Alert Trigger
Alert policy remains separate from severity:

```ts
type AlertTrigger = "WARNING_AND_HIGH" | "HIGH_ONLY" | "NONE";
```

Interpretation:

- `WARNING_AND_HIGH`: alert early
- `HIGH_ONLY`: alert only when critical
- `NONE`: reporting only, no alerting

This replaces the v1 framing that still leaned on contiguous threshold bands as the dominant pattern.

## 10. Weather Strategy
Weather should primarily be system-enriched rather than manually captured as a detailed officer input.

Where useful, a lightweight field-level context input may still be supported, for example:

- `Hot`
- `Windy`
- `Dry`
- `Recent rain`

This should be used only when:

- it is easy for officers to answer reliably
- it adds meaningful operational context
- it is not duplicating richer weather data available from the system

## 11. Pest Configuration Model
Suggested conceptual structure:

```ts
type PestConfig = {
  key: string;
  label: string;
  active: boolean;
  displayOrder: number;
  supportedObservationMethods: ObservationMethod[];
  defaultObservationMethod: ObservationMethod;
  observationConfigs: {
    method: ObservationMethod;
    fields: PestField[];
    derived?: Record<string, string>;
    severityRules: {
      condition: string;
      severity: "NORMAL" | "WARNING" | "HIGH";
    }[];
  }[];
  alertTrigger: "WARNING_AND_HIGH" | "HIGH_ONLY" | "NONE";
};
```

## 12. Pest Modeling Guidance
### 12.1 African Armyworm
Current validated baseline:

- Default method: `PHEROMONE_TRAP`
- Data shape: numeric trap count
- Optional supporting field: trap condition

Pending validation from officers:

- whether African Armyworm monitoring is trap-based only
- field-based only
- or both

If field monitoring is confirmed, a second observation config should be added using `FIELD_OBSERVATION`.

Illustrative extension:

```json
{
  "method": "FIELD_OBSERVATION",
  "fields": [
    { "key": "plants_sampled", "type": "number", "default": 100, "required": true, "prompt": "How many plants were inspected?" },
    { "key": "plants_infested", "type": "number", "required": true, "prompt": "How many inspected plants were affected?" },
    { "key": "crop_stage", "type": "select", "options": ["Seedling", "Vegetative", "Flowering", "Mature"], "required": true, "prompt": "What is the crop stage?" }
  ],
  "derived": {
    "infestation_rate": "plants_infested / plants_sampled"
  }
}
```

Current system decision:

- default African Armyworm to `PHEROMONE_TRAP` until officer validation confirms otherwise

### 12.2 Locusts
Recommended modeling direction:

- likely supports `FIELD_OBSERVATION` and/or `EVENT_OBSERVATION`
- avoid `few`, `moderate`, and `many`
- prefer numeric ranges or standardized event-size bands
- add movement and behavior fields such as `feeding`, `resting`, or `flying`
- remove interpretation labels such as `current situation`

### 12.3 Quelea Birds
Recommended modeling direction:

- use `EVENT_OBSERVATION`
- preserve flock-size reporting
- fix the missing size band between `5,000` and `20,000`
- add bird behavior field: `feeding`, `roosting`, `flying`
- remove subjective severity questions
- preserve crop type, crop stage, and area affected

### 12.4 Rodents
Recommended modeling direction:

- use `SIGN_BASED`
- preserve practical sign and damage inputs
- replace weak numeric sign counts with standardized activity level where needed
- add trend field: `increasing`, `stable`, `decreasing`

### 12.5 Fall Armyworm
Recommended modeling direction:

- default method: `PHEROMONE_TRAP`
- treat Fall Armyworm as a distinct pest from African Armyworm
- capture raw trap observations rather than officer-interpreted severity labels
- current officer feedback indicates the counted target is adult insects
- reporting unit should be `number per trap`
- do not merge Fall Armyworm into the African Armyworm baseline even if both use trap-based monitoring

Current officer-confirmed direction:

- Method used: `PHEROMONE_TRAP`
- What officers count: adult insects
- Unit used: number per trap
- Normal: `0-5`
- Warning: `6-20`
- High: `Above 20`
- Immediate alert trigger: `HIGH_ONLY`

Phase 1 modeling implication:

- Use one trap-based numeric count field for adult insects per trap
- Compute severity from trap thresholds:
  - `0-5 => NORMAL`
  - `6-20 => WARNING`
  - `>20 => HIGH`
- Configure alert policy as `HIGH_ONLY`
- Keep the flow short: count, optional photo, GPS location, pest-specific confirmation

### 12.6 Whiteflies
Recommended modeling direction:

- model separately from rodents
- likely use `FIELD_OBSERVATION`
- sampling may become important if the monitoring practice relies on affected plants or infestation proportions
- do not collapse into rodent-style sign-based logic

## 13. WhatsApp Flow Requirements
### 13.1 Updated Flow
The reporting flow should be:

1. Officer starts report
2. System presents active pest list
3. Officer selects pest
4. If that pest supports multiple methods, system asks for observation method
5. System asks method-specific structured fields in configured order
6. System asks for optional photo
7. System captures GPS location
8. System computes derived values, severity, and alert eligibility
9. System sends a pest-aware confirmation

### 13.2 Flow Design Rules
- Do not ask officers to label risk, outbreak state, or severity
- Do not force every pest into a single count question
- Skip steps that are not relevant to the chosen pest and method
- Keep prompts short and unambiguous
- Use pest-aware and method-aware wording throughout

### 13.3 Method-Aware Prompting
Examples:

- African Armyworm trap: `How many moths were caught in the trap?`
- African Armyworm field: `How many inspected plants were affected?`
- Fall Armyworm trap: `How many adult insects were caught in the trap?`
- Quelea event: `What was the estimated flock size?`
- Rodent sign-based: `What level of rodent activity was observed?`

## 14. Admin Configuration Requirements
The admin UI must evolve from simple threshold editing to full pest and observation-method configuration.

### 14.1 Admin Capabilities
Admins should be able to:

- create, edit, activate, and deactivate pest configurations
- define supported observation methods per pest
- define the default observation method
- manage method-specific fields
- define derived metrics
- define severity rules
- define alert trigger behavior
- preview officer prompts before publishing

### 14.2 UI Structure
Suggested configuration sections:

- Pest identity
- Observation methods
- Method-specific fields
- Derived values
- Severity rules
- Alert trigger
- Officer flow preview

### 14.3 Validation Rules
Admin UI should enforce:

- one default observation method per pest
- unique field keys within a method
- required field prompts for all officer-facing inputs
- compatible defaults by field type
- no use of subjective severity questions in the officer flow builder

## 15. Reporting and Analytics Requirements
### 15.1 Observation Storage
Stored observations should preserve:

- pest identity
- selected observation method
- raw structured field values
- derived values
- computed severity
- alert-trigger outcome

### 15.2 Reporting Surfaces
Dashboards and reports should display:

- pest label
- observation method
- the most important raw observation values
- derived metrics where relevant
- severity
- alert status
- location

### 15.3 Analytics Direction
The data model should support future:

- infestation-rate reporting
- trend analysis by pest and region
- comparison across officers and provinces
- forecasting or early-warning models

This is why raw observation normalization matters now.

## 16. Migration Strategy
### 16.1 Phase 1: Terminology Alignment
- Replace MPBC `Fall Armyworm` references with `African Armyworm` only where the baseline workflow actually refers to African Armyworm
- Keep `Fall Armyworm` as a formally distinct pest configuration in the current in-scope phase 1 set

### 16.2 Phase 2: Configuration Foundation
- Introduce `ObservationMethod`
- Introduce method-aware pest configuration storage
- Seed African Armyworm with `PHEROMONE_TRAP` as the default baseline configuration

### 16.3 Phase 3: Admin UI Expansion
- Add pest configuration management
- Add observation-method configuration
- Add field, derived-value, severity-rule, and alert-trigger editors

### 16.4 Phase 4: WhatsApp Runtime Refactor
- Move from hardcoded pest flow to pest-plus-method-driven flow orchestration
- Inject method-specific questions dynamically
- compute severity from rules rather than hardcoded threshold assumptions

### 16.5 Phase 5: Reporting Alignment
- surface observation method in reporting
- render structured fields and derived values clearly
- ensure exports use pest-neutral mixed-pest wording where appropriate

## 17. Open Decisions
- Is African Armyworm operationally trap-only, field-only, or both?
- If both are supported, should officers choose the method every time or should it default by assignment?
- Which pests require strict numeric input versus standardized banded input?
- Which field-condition prompts are worth keeping once system weather enrichment is available?
- Should global reusable pest templates be supported now or deferred until after org-specific rollout?

## 18. Success Criteria
This refinement is successful when:

- new pests can be added through configuration without new hardcoded flow branches
- a single pest can support multiple observation methods where needed
- officers are asked for raw observations instead of interpretation labels
- severity is computed from method-aware rules
- alert behavior is configurable independently of severity
- reporting preserves enough structure for future forecasting and trend analysis

## 19. Immediate Next Artifacts
The next implementation-facing artifacts should be:

- a schema proposal for pest configs and method-specific fields
- a WhatsApp flow runtime spec for pest and method selection
- an admin UI wireframe for pest and observation-method configuration
- a decision note resolving African Armyworm monitoring mode after officer confirmation
