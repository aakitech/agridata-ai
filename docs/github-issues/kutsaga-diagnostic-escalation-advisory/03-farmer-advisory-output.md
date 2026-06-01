# Investigation Epic: Farmer Advisory Output

## Purpose

Design how the WhatsApp bot provides safe, useful advisory responses to farmers after pest or disease reports.

## Background

Felix said the chatbot currently gives responses but not enough advisory value. Kutsaga will provide lists of pests, diseases, control measures, and products. The system should be ready to surface that content without allowing unsafe free-form pesticide advice.

## Problem Statement

Farmers need more than "thank you for your report", but automated agronomic advice carries safety, trust, liability, and regulatory risk. The system needs a controlled advisory content model.

## Goals

- Provide safe immediate next steps.
- Support Kutsaga-approved advisory messages.
- Separate generic advice from product/control recommendations.
- Support future multilingual advisory content.
- Keep all high-risk recommendations auditable and approved.

## Non-Goals

- Do not let an LLM freely recommend pesticides.
- Do not infer final disease diagnosis without expert review.
- Do not send unapproved product names.
- Do not create complex content management before basic content structure is understood.

## Advisory Response Categories

Safe automated responses:

- Report received.
- Please upload clearer photos.
- Continue monitoring.
- A specialist may review this report.
- Contact details for approved officer/support line.

Controlled responses:

- Possible pest/disease.
- Treatment or control measures.
- Product recommendation.
- Spray timing or urgency.

## Advisory Content Model

Each advisory entry may need:

- Crop.
- Pest/disease/symptom category.
- Severity band.
- Farmer-facing summary.
- Safe general advice.
- Escalation guidance.
- Approved control measures.
- Approved products.
- Restrictions/warnings.
- Language.
- Review status.
- Reviewed by.
- Reviewed date.
- Effective date.

## Technical Areas To Inspect

- `src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts`
- `src/server/modules/whatsapp-bot/workflow.ts`
- `src/server/db/schema.ts`
- `src/server/modules/reports/report-service.ts`
- Admin/settings patterns under `src/app/dashboard/settings/`

## Product Decisions Needed

- What advisory copy can be sent before Kutsaga provides approved content?
- Who approves advisory messages?
- Should advisory content be edited in the dashboard or seeded/configured initially?
- Should the bot always include a disclaimer?
- Should product advice require officer verification before being sent?
- How should advice vary by severity?
- Should advisory content be report-type-specific or pest/disease-specific?

## Suggested Phasing

### Phase 1

- Add safe generic final responses for pest and disease reports.
- Include specialist review language for disease/high-priority reports.

### Phase 2

- Add structured advisory content table/config.
- Allow exact-match approved messages for known pest/disease/severity combinations.

### Phase 3

- Add dashboard management and review workflow for advisory content.
- Add Shona translations after English content stabilises.

## Investigation Acceptance Criteria

- Safety rules are documented.
- V1 response copy is proposed.
- Advisory content model is drafted.
- Kutsaga approval workflow is defined.
- Implementation tickets are split from this epic.

