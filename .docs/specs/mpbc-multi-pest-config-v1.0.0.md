# MPBC Multi-Pest Configuration System Specification
**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** March 17, 2026  
**Context:** Evolution of MPBC from a single-pest African Armyworm reporting flow into a configurable multi-pest surveillance system.

## 1. Overview
This document defines the product and technical direction for extending MPBC reporting from a hardcoded African Armyworm trap workflow into a configuration-driven pest surveillance system.

The current African Armyworm workflow remains the baseline and reference implementation. The goal is not to discard it, but to generalize it so additional pests can be added without rewriting the reporting flow each time.

This specification intentionally starts with product model and UI requirements before implementation details. The system must remain understandable to admins, usable by officers in WhatsApp, and maintainable by the engineering team.

## 2. Background
AgriData Technologies originally digitized a single, well-defined reporting workflow for African Armyworm surveillance. That first version assumed:

- One pest: `African Armyworm`
- One monitoring method: `pheromone trap`
- One count type: `adult insects`
- One reporting unit: `per trap`
- One linear WhatsApp reporting flow

This worked because African Armyworm monitoring is relatively standardized.

Field discovery with MPBC officers later showed that MPBC monitors multiple pests with different:

- Monitoring methods
- Observation units
- Threshold ranges
- Alert trigger rules
- Extra data requirements

This means the domain model is not single-workflow with optional tweaks. It is a shared reporting engine driven by pest-specific configuration.

## 3. Canonical Terminology
The codebase and product must use the following canonical baseline terminology:

- `African Armyworm` is the correct pest name for the current MPBC baseline workflow
- `Fall Armyworm` should not appear in MPBC workflow copy, reporting copy, seeded workflow copy, or threshold examples unless a distinct future pest configuration is intentionally added

This terminology cleanup is a prerequisite for implementation alignment, but is outside the scope of this spec document.

## 4. Problem Statement
The current MPBC implementation is too tightly coupled to African Armyworm trap reporting. As a result:

- The officer flow is not valid for non-trap pests
- Questions assume one count type and one unit
- Report outputs use armyworm-specific language
- Alerting supports severity bands but not pest-specific alert trigger behavior
- Extra context fields are not captured in a structured way

The system must evolve from hardcoded workflow logic to configurable workflow orchestration.

## 5. Goals
- Support multiple pests in a single MPBC organization
- Preserve African Armyworm as the baseline reference workflow
- Externalize pest behavior into configuration rather than hardcoded conditional logic
- Make officer questions adapt to the selected pest
- Support pest-specific thresholds and alert trigger rules
- Support pest-specific extra fields such as weather, crop growth stage, and crop type
- Give admins a clear UI to manage pest configurations
- Keep the WhatsApp experience simple and low-friction for officers

## 6. Non-Goals
- Full national interoperability across all agencies in this version
- AI diagnosis or treatment recommendation logic
- Task assignment or escalation workflow automation
- Replacing the entire triage dashboard in this phase
- Designing for unlimited arbitrary workflow branching beyond pest configuration needs

## 7. Current Discovery Summary
The current officer discovery indicates five active or candidate pest workflows:

### 7.1 African Armyworm
- Monitoring method: pheromone trap
- Count target: adult insects
- Reporting unit: per trap
- Threshold shape: configured ranges
- Alert behavior: warning-level alerting
- Extra field: weather conditions
- Workflow compatibility: closest to current implementation

### 7.2 Locusts
- Monitoring method: field scouting and visual inspection
- Count target: adult insects or swarms
- Reporting unit: per m^2
- Extra field: weather conditions
- Workflow compatibility: requires unit-aware, scouting-based prompts

### 7.3 Quelea Birds
- Monitoring method: field scouting and visual inspection
- Count target: flock size
- Reporting unit: number of birds
- Extra field: crop growth stage
- Workflow compatibility: requires non-insect, non-trap wording

### 7.4 Rodents
- Monitoring method: field scouting and visual inspection
- Count target: pests, droppings, or plant damage indicators
- Reporting unit: per field
- Extra field: crop type
- Workflow compatibility: requires pest-specific clarification and guidance

### 7.5 Whiteflies
- Monitoring method: field scouting and visual inspection
- Count target: insect presence and crop damage indicators
- Reporting unit: per field
- Extra field: crop type
- Workflow compatibility: should be modeled separately from rodents even if some threshold inputs were grouped in officer feedback

## 8. Product Principles
- Baseline first: African Armyworm remains the reference flow for testing and rollout
- Configuration over branching: prefer pest config data to `if pest === ...` logic
- Guided but simple: WhatsApp prompts must stay short and unambiguous
- Pest-aware language: prompts and summaries must match the pest being reported
- Structured where necessary: capture only the fields needed for monitoring and alerting
- Safe defaults: missing configs should degrade gracefully, but clearly indicate fallback behavior

## 9. User Roles
### 9.1 Officer
- Reports field observations via WhatsApp
- Selects or confirms pest
- Provides required structured inputs
- Receives severity-aware confirmation

### 9.2 Org Admin
- Configures pest definitions for the organization
- Manages thresholds and alert behavior
- Reviews reports across mixed pest types

### 9.3 Super Admin
- Can view and support multi-org configuration
- Can help seed, migrate, or troubleshoot pest configuration setups

## 10. Product Scope
This version covers three product surfaces:

- WhatsApp reporting flow
- Admin configuration UI
- Dashboard/reporting display alignment

## 11. High-Level User Experience
### 11.1 Officer Flow
1. Officer starts report in WhatsApp
2. System presents a numbered list of active pests
3. Officer selects one pest from the list
4. System loads that pest's configuration
5. System continues with the selected pest's specific reporting flow
6. System asks count question using pest-specific wording
7. System asks pest-specific extra fields when required
8. System asks for optional photo
9. System asks for GPS location
10. System stores normalized observation data
11. System computes severity and alert eligibility
12. System sends pest-aware confirmation message

Example opening prompt:

```text
Hello {{OfficerName}}

This is the MPBC Pest Monitoring system.
Please select the pest you are reporting:

1. African Armyworm
2. Locusts
3. Quelea Birds
4. Rodents
5. Whiteflies
```

After selection, each pest continues with its own configured question sequence. The WhatsApp bot should behave like one entry point with multiple pest-specific flows behind it.

### 11.2 Admin Flow
1. Admin opens MPBC configuration area
2. Admin views all configured pests
3. Admin creates or edits a pest configuration
4. Admin defines thresholds, alert behavior, and extra fields
5. Admin previews officer prompts and severity interpretation
6. Admin saves and publishes changes

## 12. Admin UI Requirements
UI must be designed before implementation because the configuration model should reflect how humans manage it.

### 12.1 New Admin Area
Add a new MPBC-oriented configuration surface, likely under dashboard settings.

Suggested navigation label:
- `Pest Configurations`

### 12.2 Pest Configuration List View
The list view should show one card or table row per pest with:

- Pest name
- Status: active/inactive
- Monitoring method
- Reporting unit
- Threshold summary
- Alert trigger summary
- Extra field summary
- Last updated timestamp

Supported actions:

- Create pest config
- Edit pest config
- Activate/deactivate pest config
- Duplicate pest config
- Preview officer flow

### 12.3 Pest Configuration Detail Form
Each pest config should include the following sections.

#### A. Identity
- Pest name
- Internal key or slug
- Active/inactive status
- Display order in WhatsApp selection list

#### B. Monitoring Definition
- Monitoring method
- Count target label
- Reporting unit
- Question wording for count prompt
- Optional guidance text for officers

#### C. Thresholds
- Normal max
- Warning max
- High derived as greater than warning max
- Severity preview

#### D. Alert Behavior
- Trigger on `WARNING_AND_HIGH`
- Trigger on `WARNING_ONLY`
- Trigger on `HIGH_ONLY`
- Optional future support for `NONE`

#### E. Additional Required Fields
Admin can enable one or more structured extra fields, for example:

- Weather conditions
- Crop growth stage
- Crop type

Each extra field should support:

- Label
- Input type
- Required/optional
- Prompt text
- Display order

#### F. Officer Prompt Preview
UI should preview:

- Pest selection label
- Count question
- Extra questions
- Confirmation messages for normal, warning, and high

### 12.4 Threshold UI Constraints
The admin UI must make current severity logic easy to understand:

- Normal: `0..normalMax`
- Warning: `normalMax + 1 .. warningMax`
- High: `warningMax + 1+`

If the domain later needs non-contiguous bands, the threshold model will need to evolve. This version assumes contiguous numeric ranges.

## 13. WhatsApp Reporting Requirements
### 13.1 Pest Selection
The WhatsApp flow must present the currently active pest list for MPBC.

Requirements:

- This must be the first reporting step after the welcome message
- Officer can select by numeric option
- Officer can type the pest name where appropriate
- Input is normalized to the configured pest key
- Ordering follows admin-defined display order
- Once a pest is selected, the rest of the flow should follow that pest's configured prompts and rules

Example:

```text
Please select the pest you are reporting:
1. African Armyworm
2. Locusts
3. Quelea Birds
4. Rodents
5. Whiteflies
```

### 13.2 Count Question
The count prompt must be generated from pest configuration, not hardcoded.

Examples:

- African Armyworm: `How many adult insects were caught in the trap?`
- Locusts: `How many locusts were observed per m^2?`
- Quelea Birds: `What was the estimated flock size?`
- Rodents: `How many rodent signs or affected plants were observed in the field?`

### 13.3 Extra Field Injection
After count entry, the flow should ask configured extra questions in the order defined by admin.

Examples:

- Weather conditions
- Crop growth stage
- Crop type

### 13.4 Shared Inputs
All pest flows should continue to support:

- Optional photo
- Required GPS location

### 13.5 Confirmation Messaging
Confirmation messages must be pest-aware and severity-aware.

Requirements:

- Include pest name
- Include observed value
- Use organization thresholds if configured
- Indicate if fallback logic was used
- Avoid trap-specific wording for non-trap pests

## 14. Data Model Requirements
### 14.1 New Core Concept
Introduce a configurable pest definition model for organization-specific workflows.

Suggested logical entities:

- `pest_configurations`
- `pest_extra_fields`
- existing `org_alert_thresholds` may be reused or folded into pest configuration, depending on implementation choice

### 14.2 Pest Configuration Shape
Suggested conceptual structure:

```json
{
  "key": "african_armyworm",
  "label": "African Armyworm",
  "active": true,
  "displayOrder": 1,
  "monitoringMethod": "PHEROMONE_TRAP",
  "countTarget": "adult insects",
  "reportingUnit": "PER_TRAP",
  "countPrompt": "How many adult insects were caught in the trap?",
  "alertTrigger": "WARNING_ONLY",
  "thresholds": {
    "normalMax": 15,
    "warningMax": 20
  },
  "extraFields": [
    {
      "key": "weather_conditions",
      "label": "Weather conditions",
      "type": "text",
      "required": true,
      "prompt": "What were the weather conditions at the time of observation?"
    }
  ]
}
```

### 14.3 Observation Payload Shape
Reports should preserve structured observation fields separate from display copy.

Suggested logical structure:

```json
{
  "pestKey": "african_armyworm",
  "pestLabel": "African Armyworm",
  "monitoringMethod": "PHEROMONE_TRAP",
  "observedCount": 18,
  "countTarget": "adult insects",
  "reportingUnit": "PER_TRAP",
  "extraFields": {
    "weather_conditions": "Cloudy with light wind"
  }
}
```

## 15. Threshold and Alert Logic
### 15.1 Severity
Severity remains:

- `NORMAL`
- `WARNING`
- `HIGH`

### 15.2 Threshold Logic
This version assumes the current contiguous numeric model:

- `count <= normalMax` => `NORMAL`
- `count <= warningMax` => `WARNING`
- `count > warningMax` => `HIGH`

### 15.3 Alert Trigger Logic
Severity and alert trigger are separate concerns.

Examples:

- African Armyworm may compute `HIGH`, but still alert at `WARNING_ONLY` if that is the configured operational rule
- Fall Armyworm, if later added as a distinct pest, may compute `WARNING` but trigger alert only on `HIGH_ONLY`

This is a new requirement not covered by the current threshold implementation.

### 15.4 Fallback Behavior
If no pest-specific threshold exists:

- Severity may continue to use fallback logic for resilience
- Alerting should not silently assume that fallback severity implies approved operational alerting
- The UI and confirmation copy should indicate fallback clearly

## 16. Dashboard and Reporting Requirements
### 16.1 Report Detail
Mixed-pest reports should display:

- Pest label
- Monitoring method
- Observed count
- Reporting unit
- Extra field values
- Severity
- Whether alert criteria were met

The current dashboard already supports core mixed-pest display reasonably well for baseline reporting:

- reports can already carry pest labels
- reports pages already support pest filtering
- grouped and list views already show pest, severity, officer, and location

This means the dashboard should be evolved, not replaced. The main additions are pest-specific structured fields and clearer display of monitoring method, reporting unit, and extra-field context.

### 16.2 Reports Listing
Reports pages should support filtering by:

- Pest
- Severity
- Date range
- Officer
- Monitoring method

Current-state note:

- Pest filtering already exists in the current reports page
- Severity, officer, organization, and date filtering also already exist
- The gap is not basic listing capability; the gap is richer pest-specific report content and pest-aware wording

### 16.3 PDF / Export Alignment
MPBC report rendering must no longer assume only African Armyworm unless the export itself is explicitly scoped to African Armyworm.

If a report covers multiple pests, titles and summary wording must be generic, for example:

- `MPBC Pest Surveillance Report`
- `High Alert Observations`

## 17. Migration Strategy
### 17.1 Phase 1: Terminology Alignment
- Replace MPBC `Fall Armyworm` references with `African Armyworm`
- Align seeded workflow, docs, and reporting copy

### 17.2 Phase 2: Configuration Model Introduction
- Add pest configuration storage
- Seed African Armyworm as the first config
- Keep behavior identical to current baseline where possible

### 17.3 Phase 3: Admin UI
- Ship pest configuration management UI
- Allow threshold and extra-field editing
- Add preview support

### 17.4 Phase 4: Dynamic WhatsApp Flow
- Replace hardcoded MPBC pest prompts with config-driven prompts
- Inject extra fields dynamically
- Support active pest list selection

### 17.5 Phase 5: Reporting Surface Updates
- Update dashboard and exports for multi-pest display

## 18. Success Criteria
This specification is successful when:

- African Armyworm remains fully supported as the baseline workflow
- New pests can be added through configuration rather than new code branches
- Officers see pest-appropriate wording in WhatsApp
- Admins can manage thresholds and extra fields without developer intervention
- Reports and exports accurately reflect mixed pest workflows

## 19. Risks
- Over-designing the workflow engine beyond actual operational needs
- Modeling extra fields too loosely and losing validation quality
- Keeping threshold severity and alert trigger coupled when they should be separate
- Updating the officer flow before admin UI is clear
- Migrating terminology inconsistently and creating data normalization issues

## 20. Open Questions
- Should pest configurations be organization-specific only, or support reusable global templates?
- Should extra fields support typed options like dropdown values, or text-only in v1?
- Should inactive pests remain filterable in historical reports?
- Should alert trigger configuration live inside the pest config or remain in a separate alerts table?
- Do rodents and whiteflies require fully separate configurations immediately, or can whiteflies be deferred until clarified with MPBC?
- Should officer flow always ask the pest question, or allow a default pest shortcut for officers assigned to only one pest?

## 21. Recommended Immediate Next Artifacts
After approval of this spec, the next documents to produce should be:

- A wireframe-level admin UI spec for `Pest Configurations`
- A technical schema proposal for pest configuration storage
- A WhatsApp dynamic workflow spec derived from the approved UI and config model
