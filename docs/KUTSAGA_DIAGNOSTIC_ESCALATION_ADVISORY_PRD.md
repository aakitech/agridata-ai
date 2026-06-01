# Product Requirements Document - Kutsaga Diagnostic, Escalation, and Advisory Roadmap

**Version:** v0.1  
**Last Updated:** June 1, 2026  
**Status:** Draft for planning  
**Primary Stakeholders:** AgriData AI, Kutsaga officers, Kutsaga research officers, tobacco farmers/reporters

---

## Overview

Kutsaga feedback confirms that the WhatsApp pilot should evolve beyond field data collection into a structured diagnostic, escalation, and advisory workflow.

The immediate product direction is:

```text
Surveillance first -> expert-assisted advisory second -> AI diagnosis later
```

This PRD is the strategic source of truth for the next planning phase. It captures the major workstreams, prioritisation logic, product safety boundaries, and technical investigation areas needed before implementation.

Detailed discovery and implementation planning should happen in the linked GitHub issue drafts under:

```text
docs/github-issues/kutsaga-diagnostic-escalation-advisory/
```

---

## Background

The current Track A Kutsaga pilot is focused on farmer-friendly WhatsApp pest surveillance for tobacco. It already supports:

- Kutsaga as a separate organization.
- Kutsaga-specific pest configuration.
- WhatsApp report submission.
- GPS and image-capable field reports.
- Dashboard visibility under the Kutsaga organization.
- Draft pest flows for Aphids, Mealybug, Budworm, and Falsewire worm.

Felix's latest feedback adds five product needs:

1. Improve pest and disease question structure.
2. Provide useful farmer advisory output.
3. Add referral and escalation to Kutsaga officers.
4. Collect images for future AI model training.
5. Add language support, especially Shona.

This shifts the roadmap from a simple reporting pilot toward a field intelligence workflow:

```text
Farmers report -> Kutsaga sees -> officers prioritise -> experts advise -> data accumulates -> AI improves later
```

---

## Problem Statement

Farmers and field reporters can submit observations, but the system does not yet provide enough structure or workflow support for Kutsaga to reliably diagnose, prioritise, respond, and build future model-training datasets.

The current gaps are:

- Disease reporting is not yet first-class.
- The bot does not yet capture enough disease-specific diagnostic context.
- Dashboard alerts are not yet shaped around specialist review and officer workflows.
- Farmer responses are mostly collection acknowledgements, not advisory next steps.
- Images are collected, but not yet managed as labelled training assets.
- Officers do not yet have a case-style review and follow-up workflow.
- Language support is not yet designed for agronomic and advisory content.
- Proactive WhatsApp follow-up from officers is not yet defined.

---

## Goals

### Product Goals

- Improve pest and disease diagnostic data quality.
- Make disease reporting a high-priority workflow.
- Help Kutsaga officers identify reports that need review.
- Give farmers safe, useful next-step responses.
- Create a path from today's reports to future AI-ready labelled datasets.
- Support phased delivery so each major area can be investigated and built independently.

### Business Goals

- Increase the practical value Kutsaga receives before AI model training is ready.
- Strengthen AgriData as the data and workflow layer for pest and disease surveillance.
- Build a scalable foundation for other crops, organizations, and advisory workflows.
- Avoid unsafe product promises around automated pesticide recommendations.

### Technical Goals

- Keep diagnostic flows configurable by organization and crop.
- Preserve multi-tenant isolation.
- Store reports, images, alerts, annotations, and advisory content in structured form.
- Design alerting and escalation so channels can expand over time.
- Keep future AI training needs in mind without blocking near-term pilot value.

---

## Non-Goals

This planning phase does not aim to:

- Build a full AI disease identification model.
- Allow the bot to freely generate pesticide recommendations.
- Replace Kutsaga expert verification.
- Implement all notification channels at once.
- Build a full CRM or contact centre product.
- Translate unapproved agronomy or pesticide advice automatically.
- Support all crops immediately.

---

## Product Safety Principles

The bot must distinguish between safe operational guidance and high-risk agronomic recommendations.

Safe in early versions:

- Confirming report receipt.
- Requesting clearer images.
- Advising continued monitoring.
- Telling the farmer a specialist may review the report.
- Providing officer contact details if approved by Kutsaga.
- Sharing expert-approved general guidance.

Controlled and Kutsaga-approved only:

- Naming a likely pest or disease.
- Giving product or pesticide guidance.
- Recommending control measures.
- Advising urgency of treatment.

Avoid in v1:

- Unsupervised pesticide recommendations.
- "Spray immediately" style advice.
- AI-generated product advice without expert-approved source content.

Internal rule:

```text
The bot can provide general advisory guidance, but product or pesticide recommendations must come from Kutsaga-approved content or expert review.
```

---

## User Groups

### Farmer / Reporter

Needs:

- Simple WhatsApp flow.
- Clear questions in familiar language.
- Ability to send images and location.
- Confirmation that the report was received.
- Practical next steps.

### Kutsaga Officer

Needs:

- Dashboard visibility into new and high-priority reports.
- Alerts with enough context to decide what needs follow-up.
- Ability to contact farmers, request more information, and record notes.
- Ability to prioritise disease and severe reports.

### Kutsaga Research Officer / Specialist

Needs:

- Ability to verify disease/pest reports.
- Access to report answers, images, and location.
- Annotation workflow for image quality and labels.
- Control over approved advisory content.

### AgriData Team

Needs:

- Clear phasing.
- Implementation-ready issues.
- Technical investigation boundaries.
- A scalable architecture for future organizations and datasets.

---

## Workstreams

### 1. Disease Diagnostic Flow

Make disease reporting a first-class WhatsApp flow with disease-specific questions, image prompts, severity/spread indicators, and GPS capture.

Issue draft:

- `01-disease-diagnostic-flow.md`

### 2. Notifications and Escalation

Design how reports become alerts, how priority is assigned, how officers are notified, and how alert state is managed.

Issue draft:

- `02-notifications-escalation.md`

### 3. Farmer Advisory Output

Design safe bot responses and Kutsaga-approved advisory content. Separate generic next steps from controlled product/control recommendations.

Issue draft:

- `03-farmer-advisory-output.md`

### 4. Officer Review and Referral Workflow

Design case-style review flows for officers: assign, review, contact farmer, record notes, resolve, and escalate to specialists.

Issue draft:

- `04-officer-review-referral.md`

### 5. Image Annotation and Training Dataset

Design how images are stored, reviewed, labelled, quality-scored, and marked as training eligible.

Issue draft:

- `05-image-annotation-training-dataset.md`

### 6. Language Support

Design English/Shona language selection, translated flow content, and safe handling of advisory translations.

Issue draft:

- `06-language-support.md`

### 7. WhatsApp Follow-Up Messaging

Design how the system may support outbound follow-up from officers, including Twilio/WhatsApp template constraints and auditability.

Issue draft:

- `07-whatsapp-follow-up-messaging.md`

---

## Recommended Phasing

### Phase 0 - Planning and Discovery

Outcome:

- Validate this PRD.
- Open investigation issues.
- Review current code surfaces and data model.
- Confirm Kutsaga content inputs and pilot priorities.

Priority:

- Immediate.

### Phase 1 - Better Surveillance and Disease Intake

Outcome:

- Add pest/disease entry point.
- Add disease diagnostic flow.
- Improve image instructions.
- Keep final farmer response safe and simple.

Priority:

- Highest.

Reason:

- Kutsaga specifically identified question structure and disease reporting as immediate priorities.
- Better intake improves all downstream workflows.

### Phase 2 - Dashboard Alerting and Officer Triage

Outcome:

- Disease reports are flagged.
- High-severity reports surface in dashboard.
- Officers can update status and record review notes.

Priority:

- Highest, but may be implemented after initial flow design.

Reason:

- Notifications are large enough to require separate investigation.
- Disease flow and alerting depend on each other but can be phased.

### Phase 3 - Safe Advisory Output

Outcome:

- Bot provides safe generic next steps.
- Kutsaga-approved advisory content model exists.
- Product/control recommendations remain controlled.

Priority:

- High.

Reason:

- Advisory output is central to farmer value, but must be safer than free-form AI.

### Phase 4 - Image Annotation and Dataset Foundation

Outcome:

- Officers/specialists can label images.
- Images are linked to metadata and training eligibility.
- Dataset export path can be planned.

Priority:

- High.

Reason:

- The earlier image labels are captured, the stronger future model-training data becomes.

### Phase 5 - Language Support

Outcome:

- Farmers can choose English or Shona.
- Stable flow copy is translated and approved.
- Advisory translation process is defined.

Priority:

- Medium to high.

Reason:

- Important for adoption, but best after flow content stabilises.

### Phase 6 - Proactive Follow-Up Messaging

Outcome:

- Officers can request more photos or send approved follow-up messages through WhatsApp if technically and operationally approved.

Priority:

- Medium.

Reason:

- Valuable, but depends on officer workflow, WhatsApp policy constraints, and template decisions.

---

## Current Technical Surfaces To Investigate

Likely code areas:

- WhatsApp webhook: `src/app/api/webhooks/whatsapp/route.ts`
- Workflow engine: `src/server/modules/whatsapp-bot/workflow.ts`
- Config-driven processor: `src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts`
- Workflow types: `src/server/modules/whatsapp-bot/workflow-types.ts`
- Report service: `src/server/modules/reports/report-service.ts`
- Report types: `src/server/modules/reports/report-types.ts`
- Alert service: `src/server/modules/alerts/alerts-service.ts`
- Alert settings UI: `src/app/dashboard/settings/alerts/page.tsx`
- Triage dashboard: `src/app/dashboard/triage/page.tsx`
- Triage service: `src/server/modules/triage/triage-service.ts`
- Database schema: `src/server/db/schema.ts`
- Media service: `src/server/modules/media/media-service.ts`

Existing docs to preserve context:

- `docs/KUTSAGA_TRACK_A_WHATSAPP_PILOT_WIKI.md`
- `docs/MULTI_TENANT_ONBOARDING_READINESS_PLAN.md`
- `docs/FEATURE_WHATSAPP_SESSION_COMMANDS_PRD.md`
- `docs/MPBC_PEST_WORKFLOW_QUESTION_AUDIT.md`

---

## Data Strategy

Every pest or disease report should move toward a reusable surveillance dataset.

Minimum report metadata:

- Organization.
- Reporter/farmer.
- Crop.
- Pest or disease category.
- Symptoms.
- Severity/spread.
- Date/time.
- GPS.
- Images.
- Recent treatment/action taken.
- Bot language.
- Escalation status.
- Expert review status.

Minimum image metadata:

- Report ID.
- Crop.
- Suspected pest/disease.
- Plant part visible.
- Image quality.
- Expert label.
- Expert confidence.
- Training eligibility.
- Notes.

Long-term value:

- Structured surveillance history.
- Faster officer triage.
- More consistent advisory logic.
- Future image recognition and forecasting datasets.

---

## Open Product Questions

- Should disease reporting be available to all Kutsaga reporters immediately, or gated to pilot users first?
- Which disease categories should be included in v1?
- Should reports always include images for disease flows, or allow submission without images?
- Who receives disease alerts first: Kutsaga officers, Kutsaga research officers, or both?
- What constitutes high priority for disease reports?
- Should the farmer receive officer contact details automatically?
- What advisory copy can be sent before Kutsaga provides product/control measures?
- Who approves advisory content and translations?
- How should officer actions be audited?
- Which WhatsApp outbound use cases require templates?

---

## Success Metrics

Pilot success can be measured by:

- Number of completed pest and disease reports.
- Percentage of disease reports with usable images.
- Percentage of reports with GPS.
- Time from disease report submission to officer review.
- Number of reports escalated.
- Number of reports resolved or contacted.
- Number of images labelled by specialists.
- Percentage of farmer flows completed without manual support.
- Farmer/officer feedback on clarity of questions.
- Advisory content coverage by pest/disease.

---

## Linked Issue Drafts

- [Disease Diagnostic Flow](github-issues/kutsaga-diagnostic-escalation-advisory/01-disease-diagnostic-flow.md)
- [Notifications and Escalation](github-issues/kutsaga-diagnostic-escalation-advisory/02-notifications-escalation.md)
- [Farmer Advisory Output](github-issues/kutsaga-diagnostic-escalation-advisory/03-farmer-advisory-output.md)
- [Officer Review and Referral Workflow](github-issues/kutsaga-diagnostic-escalation-advisory/04-officer-review-referral.md)
- [Image Annotation and Training Dataset](github-issues/kutsaga-diagnostic-escalation-advisory/05-image-annotation-training-dataset.md)
- [Language Support](github-issues/kutsaga-diagnostic-escalation-advisory/06-language-support.md)
- [WhatsApp Follow-Up Messaging](github-issues/kutsaga-diagnostic-escalation-advisory/07-whatsapp-follow-up-messaging.md)

