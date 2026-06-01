# Investigation Epic: WhatsApp Follow-Up Messaging

## Purpose

Design how Kutsaga officers may send follow-up messages to farmers after a report is submitted.

## Background

The bot currently replies as part of inbound WhatsApp flows, but the platform does not yet support a full officer-driven outbound follow-up workflow. Felix asked for referral to officers and officer contact details; future versions may support officer messages from the dashboard.

## Problem Statement

Officer follow-up is operationally valuable, but WhatsApp outbound messaging has product, audit, consent, and provider constraints. This needs separate investigation from basic bot responses.

## Goals

- Define what follow-up messages are allowed.
- Understand Twilio/WhatsApp template constraints.
- Support officer requests for more photos or clarification.
- Preserve audit trail of outbound messages.
- Keep farmer communication safe and approved.

## Non-Goals

- Do not build free-form mass messaging in v1.
- Do not bypass WhatsApp consent or template requirements.
- Do not combine this with all notification work.
- Do not send unapproved pesticide recommendations.

## Candidate Follow-Up Message Types

Safe first templates:

- Request clearer photo.
- Request photo of another plant part.
- Confirm officer reviewed report.
- Ask farmer to expect a phone call.
- Share approved officer contact details.

Controlled templates:

- Advisory recommendation.
- Product/control guidance.
- Urgent treatment instruction.

## Technical Areas To Inspect

- `src/app/api/webhooks/whatsapp/route.ts`
- WhatsApp/Twilio send path in current bot implementation.
- `src/server/modules/whatsapp-bot/workflow.ts`
- `src/server/db/schema.ts`
- Existing environment variables for Twilio.
- Dashboard triage/report detail components.

## Product Decisions Needed

- Should v1 support officer free text or only approved templates?
- Should all outbound messages be tied to a report/review item?
- Who can send follow-up messages?
- Do messages require approval before sending?
- How are WhatsApp template approvals managed?
- What happens if the WhatsApp 24-hour session window is closed?
- Should officers call farmers outside the system in v1 and only record notes?

## Suggested Phasing

### Phase 1

- Do not send officer messages from dashboard yet.
- Let officers record "called farmer" and "requested more photos" notes.
- Provide farmer with approved contact details at flow end if Kutsaga wants this.

### Phase 2

- Add approved template-based follow-up messages from report detail.
- Audit all outbound messages.
- Link messages to report/review status.

### Phase 3

- Add richer two-way case messaging if operationally needed.

## Investigation Acceptance Criteria

- Current WhatsApp send capabilities are mapped.
- WhatsApp provider constraints are documented.
- V1 follow-up scope is recommended.
- Template vs free-text decision is made.
- Implementation tickets are split from this epic.

