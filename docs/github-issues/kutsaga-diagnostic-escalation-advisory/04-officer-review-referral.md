# Investigation Epic: Officer Review and Referral Workflow

## Purpose

Design the workflow that lets Kutsaga officers review submitted reports, contact farmers, annotate findings, and resolve cases.

## Background

Felix described an interim process where farmers can be redirected to Research Officers for verification and further guidance while AI diagnosis remains a long-term goal.

## Problem Statement

Dashboard visibility alone is not enough for operational follow-up. Officers need a lightweight case workflow to track which reports have been reviewed, who contacted the farmer, what guidance was given, and whether the case is resolved.

## Goals

- Turn high-priority reports into actionable review items.
- Allow assignment to officers.
- Record contact attempts and notes.
- Support expert verification and referral.
- Preserve the review history for accountability and training data.

## Non-Goals

- Do not build a full customer support platform in v1.
- Do not require all officer interactions to happen inside WhatsApp immediately.
- Do not replace phone calls where that is the practical path.

## Candidate Workflow

1. Report creates alert or review item.
2. Officer opens report detail.
3. Officer reviews answers, images, and location.
4. Officer assigns to self or another specialist.
5. Officer records action:
   - Needs more photos
   - Called farmer
   - Provided guidance
   - Escalated to research officer
   - Closed
6. Specialist can add verification label and notes.
7. Case is resolved or closed.

## Data Requirements

Review item should capture:

- Report ID.
- Alert ID if applicable.
- Assigned officer.
- Status.
- Priority.
- Contact notes.
- Verification outcome.
- Recommended follow-up.
- Resolution summary.
- Timestamps.

## Technical Areas To Inspect

- `src/app/dashboard/triage/page.tsx`
- `src/app/dashboard/triage/_components/triage-dashboard.tsx`
- `src/app/dashboard/triage/_components/report-detail.tsx`
- `src/server/modules/triage/triage-service.ts`
- `src/server/api/routers/enhancements.ts`
- `src/server/db/schema.ts`

## Product Decisions Needed

- Is this workflow built into the existing triage area or a new alerts/review page?
- Which roles can assign, review, and resolve?
- Should farmers see case status?
- What status names match Kutsaga operations?
- Should notes be internal only?
- Should specialist verification feed image labels automatically?

## Suggested Phasing

### Phase 1

- Add basic review status and notes.
- Allow officer to mark contacted/resolved.
- Show disease/high-priority reports in a review queue.

### Phase 2

- Add assignment and filtering.
- Add verification fields.
- Link review outcomes to advisory and annotation workflows.

### Phase 3

- Add richer case history and outbound WhatsApp follow-up.

## Investigation Acceptance Criteria

- Current triage capability is reviewed.
- V1 status model is defined.
- Role and permission needs are documented.
- Data model gaps are identified.
- Implementation tickets are split from this epic.

