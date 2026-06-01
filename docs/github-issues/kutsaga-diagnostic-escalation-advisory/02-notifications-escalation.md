# Investigation Epic: Notifications and Escalation

## Purpose

Design the notification and escalation system for Kutsaga reports, with disease reports treated as a high-priority starting case.

This is a large workstream and should be investigated independently before implementation.

## Background

Felix asked for Kutsaga officers to receive notifications when farmers submit disease-related reports. Kundai also suggested dashboard alerts for each inquiry so officers can monitor interactions in real time.

## Problem Statement

The system needs to move from passive dashboard visibility to active operational triage. Not every report should be treated the same. Disease reports, high-severity pest reports, poor-confidence reports, and clustered reports may require escalation.

## Goals

- Define what creates an alert.
- Define alert priority and reason codes.
- Define where alerts appear first.
- Define who should receive alerts.
- Define alert status lifecycle.
- Keep notification channels configurable and phased.

## Non-Goals

- Do not build every outbound channel in v1.
- Do not send pesticide advice through notifications.
- Do not replace dashboard report browsing.
- Do not create noisy alerts without configuration.

## Alert Trigger Candidates

Create alerts when:

- Report type is disease.
- Disease spread is "many plants" or "most of the field".
- Pest severity is warning or high.
- Farmer asks for help.
- Report includes concerning images.
- Same farmer/farm reports worsening symptoms.
- Multiple reports cluster in the same area.
- Trap/pest thresholds are crossed.
- Report has low confidence but high concern.

## Alert Object Requirements

Each alert should include:

- Alert ID.
- Report ID.
- Organization ID.
- Priority: low, medium, high.
- Alert reason.
- Crop.
- Pest/disease/symptom category.
- Location.
- Reporter/farmer contact.
- Images.
- Status.
- Assigned officer.
- Created date.
- Last updated date.
- Review notes.

Suggested statuses:

- New
- Reviewing
- Contacted farmer
- Waiting for information
- Escalated
- Resolved
- Closed as no action needed

## Notification Channels

Phase channels separately:

- Dashboard alerts first.
- Email summary or immediate email second.
- WhatsApp/SMS officer notifications later.
- Proactive farmer follow-up as a separate workstream.

## Technical Areas To Inspect

- `src/server/modules/alerts/alerts-service.ts`
- `src/server/api/routers/alerts.ts`
- `src/app/dashboard/settings/alerts/page.tsx`
- `src/app/dashboard/settings/alerts/_components/alert-thresholds-table.tsx`
- `src/app/dashboard/triage/page.tsx`
- `src/server/modules/triage/triage-service.ts`
- `src/server/modules/reports/report-service.ts`
- `src/server/db/schema.ts`

## Product Decisions Needed

- Should every disease report become an alert by default?
- Which reports should create immediate officer notifications vs dashboard-only alerts?
- Who configures thresholds?
- Should thresholds be organization-wide, crop-specific, pest-specific, or disease-specific?
- Should alerts be assigned automatically by geography, crop, or role?
- How should alert fatigue be managed?
- What is the minimum v1 notification channel?

## Suggested Phasing

### Phase 1

- Create dashboard alert records for disease reports and high-severity pest reports.
- Show alerts in an operational dashboard or triage view.
- Allow status update and notes.

### Phase 2

- Add configurable alert rules and thresholds.
- Add assignment to officers.
- Add filtering by status, priority, location, and report type.

### Phase 3

- Add outbound officer notifications.
- Add grouped/digest notifications to reduce noise.
- Add clustering and repeated-report escalation.

## Investigation Acceptance Criteria

- Current alert and triage capabilities are mapped.
- V1 alert lifecycle is defined.
- Channel strategy is documented.
- Data model gaps are identified.
- Implementation tickets are split from this epic.

