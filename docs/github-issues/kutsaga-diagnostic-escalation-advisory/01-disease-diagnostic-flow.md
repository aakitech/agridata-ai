# Investigation Epic: Kutsaga Disease Diagnostic Flow

## Purpose

Design a first-class WhatsApp disease reporting flow for Kutsaga tobacco farmers/reporters.

This issue should be used as the starting point for product discovery, technical investigation, and later implementation tickets.

## Background

Felix identified disease detection and disease-related officer follow-up as a high priority. Farmers often describe what they see with their eyes, may not have traps, and may not send high-quality images. The flow needs to collect enough structured context for Kutsaga officers to decide whether specialist review is needed.

## Problem Statement

The current Kutsaga WhatsApp flow is pest-focused. Disease reports need different questions from pest/trap surveillance because diagnosis depends on symptoms, affected plant parts, spread, timing, images, and recent treatment history.

## Goals

- Add a clear pest vs disease entry point.
- Capture disease-specific diagnostic context.
- Improve image instructions for low-technical farmers.
- Preserve data needed for dashboard triage and future AI training.
- Keep the flow short enough for WhatsApp completion.

## Non-Goals

- Do not build AI diagnosis in this phase.
- Do not give final pesticide/product advice from this flow alone.
- Do not support every crop in v1.
- Do not require farmers to know disease names.

## Initial V1 Flow Shape

1. Farmer starts report.
2. Bot asks what they are reporting:
   - Pest/insect problem
   - Disease/symptom problem
   - Other/unsure
3. If disease/symptom problem:
   - Confirm crop.
   - Ask affected plant part.
   - Ask visible symptoms.
   - Ask spread/severity.
   - Ask when first noticed.
   - Ask recent spray/treatment.
   - Request clear images.
   - Request GPS.
   - Confirm receipt and specialist review possibility.

## Candidate Disease Questions

Affected plant part:

- Leaves
- Stem
- Roots
- Whole plant
- Seedbed
- Not sure

Symptoms:

- Yellowing
- Wilting
- Spots or lesions
- Mould or fungal growth
- Rotting
- Stunted growth
- Leaves curling
- Other or not sure

Spread:

- One/few plants
- Several plants
- Many plants
- Most of the field
- Not sure

Timing:

- Today
- Last few days
- About a week ago
- More than a week ago
- Not sure

Recent action:

- Recently sprayed or treated
- No recent treatment
- Not sure

## Image Prompt Requirements

The disease flow should request practical image types:

- Whole affected plant.
- Close-up of affected leaf/stem/root.
- Wider field or seedbed view if possible.

The bot should use simple copy and not assume photographic skill.

## Technical Areas To Inspect

- `src/server/modules/whatsapp-bot/workflow-types.ts`
- `src/server/modules/whatsapp-bot/workflow.ts`
- `src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts`
- `scripts/seed-kutsaga-placeholder-configs.ts`
- `src/server/modules/reports/report-service.ts`
- `src/server/db/schema.ts`

## Product Decisions Needed

- Which disease/symptom categories should be included in v1?
- Should disease reports require images before submission?
- Should disease reports always become alerts?
- Should the bot allow "not sure" at every step?
- Should disease and pest flows share a report table/type or use a separate disease report entity?
- Should disease flow copy mention Kutsaga officer follow-up?

## Suggested Phasing

### Phase 1

- Add pest vs disease selection.
- Add generic disease diagnostic questions.
- Store disease report fields in existing report structure if feasible.
- Flag disease report for specialist review.

### Phase 2

- Make disease questions configurable by crop and organization.
- Add disease-specific branching once Kutsaga provides disease lists.
- Improve image guidance and validation.

### Phase 3

- Link disease flow to advisory content and image annotation workflow.

## Investigation Acceptance Criteria

- Current workflow architecture is reviewed.
- Recommended data model approach is documented.
- V1 disease question list is confirmed.
- Alerting dependency is identified.
- Implementation tickets are split from this epic.

