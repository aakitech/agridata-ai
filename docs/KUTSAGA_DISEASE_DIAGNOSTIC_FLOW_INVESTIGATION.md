# Kutsaga Disease Diagnostic Flow Investigation

Issue: #22

## Purpose

This investigation responds to Kutsaga's latest feedback that the WhatsApp pilot should eventually support disease diagnostics, officer follow-up, farmer advisory output, and future image-training readiness.

The current Kutsaga pilot is pest-focused. Disease and symptom reports need a different intake pattern because farmers may not know disease names and may only be able to describe visible symptoms, affected plant parts, spread, timing, treatment history, and images.

The recommended V1 approach is symptom intake plus officer review. The bot should not attempt automated disease diagnosis or pesticide/product advice in this phase.

## Current System Review

The current WhatsApp flow is pest-config driven. Kutsaga pest reporting is seeded through the Kutsaga configuration script and processed through the existing WhatsApp bot processor.

The existing report model already supports several fields that are useful for disease reports:

- `category`
- `dataPayload`
- `mediaUrl`
- `location`
- `severity`
- `status`
- `diagnosis`
- `riskLevel`
- `verifiedAt`
- `verifiedBy`

The existing triage dashboard already supports report review, verification, and rejection. However, the current UI and copy are still pest-oriented and AI-training-oriented. For disease reports, the dashboard should be generalized so it can show a Disease/Symptom report clearly and display symptom context in a readable way.

## Recommended V1 Flow

```text
Farmer starts report
-> answers whether they saw insects/pests or plant damage/symptoms
-> Pest/Insect continues through the pest flow
-> Damage/Symptoms and Other/Not sure enter the symptom intake flow
-> Disease/Symptom flow confirms tobacco
-> asks affected plant part
-> asks visible symptoms
-> asks spread/severity
-> asks when first noticed
-> asks recent spray/treatment
-> requests optional images
-> requests GPS
-> confirms receipt and says Kutsaga may review/follow up
```

The first question should be:

```text
What are you seeing?
1. I saw insects or pests
2. I see damage or symptoms on the plant
3. Other / not sure
```

For V1, farmers should not be required to know or select a disease name. They should describe what they see. `Other / not sure` should not be a dead end; it should route into the symptom intake flow because that is the most general path for officer review.

Candidate disease questions:

- Crop: Tobacco
- Affected plant part: Leaves, Stem, Roots, Whole plant, Seedbed, Not sure
- Visible symptoms: Yellowing, Wilting, Spots or lesions, Mould or fungal growth, Rotting, Stunted growth, Leaves curling, Other / not sure
- Spread: One/few plants, Several plants, Many plants, Most of the field, Not sure
- First noticed: Today, Last few days, About a week ago, More than a week ago, Not sure
- Recent treatment: Recently sprayed or treated, No recent treatment, Not sure
- Images: optional but strongly encouraged
- Location: required where possible

Image guidance should use simple language. The bot should ask for practical images such as:

- Whole affected plant
- Close-up of affected leaf, stem, or root
- Wider field or seedbed view, if possible

## Example Disease Report

```text
Report Type: Disease/Symptom
Crop: Tobacco
Affected part: Leaves
Symptoms: Yellowing, leaves curling
Spread: Several plants
First noticed: Last few days
Recent treatment: No recent treatment
Photos: 2 uploaded
GPS: captured
Status: Pending Review
Severity: Warning
```

This is more useful than a free-text farmer message because it gives the officer structured context before review.

## Officer Review Outcome

Officers should diagnose or review disease reports from the dashboard, not WhatsApp.

```text
Officer opens report in dashboard
-> reviews symptoms/photos/location/timing/treatment
-> records likely issue or diagnosis
-> selects risk level
-> adds notes
-> marks as Reviewed/Verified, Escalated, or Rejected
```

Recommended V1 review outcomes:

- Reviewed/Verified: officer has enough information to record a likely issue or diagnosis.
- Escalated: specialist or Research Officer follow-up is needed.
- Rejected: report is invalid, duplicate, or does not contain enough useful information.
- Inconclusive / needs more information: defer until farmer follow-up messaging exists, because it needs a way to request more information from the farmer.

Reviewed outcomes should update the dashboard status first. Farmer-facing follow-up should be handled by the advisory/follow-up messaging workstream unless approved advisory content and messaging rules are ready.

## Dashboard Recommendation

Use existing reports and triage surfaces for V1 instead of creating a new disease dashboard.

Recommended dashboard behavior:

```text
Disease report submitted
-> appears in reports dashboard
-> category shown as Disease/Symptom
-> status starts as Pending Review / Pending Triage
-> officers are notified or given a queue item regardless of severity
-> officer/admin can open report details
-> symptom fields are shown clearly
-> high severity disease reports are ranked higher and may trigger louder escalation
```

The dashboard should avoid pest-only labels for disease reports. Examples:

- Use `Disease/Symptom` instead of `Pest` where appropriate.
- Use `Symptoms` or `Primary observation` instead of `Primary pest value`.
- Show captured symptom fields as a structured summary.
- Keep reviewed outcomes internal until follow-up messaging is implemented.

Notification and severity must remain separate:

- Notification / queue policy: every `category = DISEASE` report should enter the Pending Review queue and notify or surface to officers, regardless of severity.
- Severity policy: severity should stay differentiated and should be used to rank reports within the review queue and drive louder escalation for urgent cases.
- High severity should not be assigned to every disease report. If everything is high, officers lose the ability to prioritize true field-wide problems.

Suggested V1 severity mapping can be based on spread:

```text
One/few plants -> Normal / Low
Several plants -> Warning
Many plants -> High
Most of the field -> High
Not sure -> Normal/Unknown priority until reviewed, unless another high-risk signal exists
```

Disease severity is farmer self-reported in V1 and should be treated as an initial estimate, not a verified diagnosis or risk assessment. Low and warning reports still enter the officer review queue. High severity reports should receive stronger visual priority and escalation, but severity should never be the condition for whether officers are told about a disease report.

## Data Model Recommendation

Use the existing `reports` table for V1 if feasible.

Recommended V1 storage shape:

- `category`: `DISEASE`
- `status`: `PENDING_TRIAGE` / Pending Review
- `label`: `Disease/Symptom`
- `dataPayload.raw`: structured symptom answers
- `mediaUrl` / media relation: uploaded image references
- `location`: WhatsApp GPS location
- `severity`: derived from spread/severity response
- `severitySource`: should identify disease severity as farmer self-reported, such as `SELF_REPORT`, so the dashboard can show that it is not yet verified
- `diagnosis`, `riskLevel`, `verifiedAt`, `verifiedBy`: populated during officer review

If implementation shows that `category = DISEASE` is not currently supported by the enum or UI, add it as a focused schema/UI change rather than creating a separate disease report table.

If the current `severitySource` enum does not support a self-reported value, add one as part of implementation. The officer's reviewed `riskLevel` should remain the authoritative risk assessment after review.

Do not create a separate disease report entity in V1 unless the existing reports model blocks core behavior.

## Implementation Tickets To Create

1. Add Kutsaga intake entry point using plant-friendly wording: insect/pest seen, plant damage/symptoms seen, or other/not sure.
2. Add generic Kutsaga disease diagnostic question configuration.
3. Store disease reports in the existing report structure with `category = DISEASE`.
4. Route `Other / not sure` into the symptom intake flow so officers can classify the report later.
5. Generalize report/dashboard labels from pest-only to report-type-aware copy.
6. Show disease symptom fields clearly in report details and triage.
7. Add disease review queue/notification behavior for every disease report, independent of severity.
8. Add self-reported disease severity source support, such as `SELF_REPORT`, and display it clearly in the dashboard.
9. Add high-severity disease escalation behavior based on spread, separate from the base review notification.
10. Add optional disease image guidance copy.
11. Defer farmer advisory, inconclusive follow-up, and WhatsApp follow-up messaging to separate issues.

## Validation Plan

This issue should be complete when:

- The current workflow architecture has been reviewed.
- The recommended data model approach is documented.
- The V1 disease question list is documented.
- The alerting/escalation dependency is identified.
- The plan separates disease review notification from severity ranking/escalation.
- The plan treats disease severity as farmer self-reported until officer review.
- Follow-up implementation tickets are split from this investigation.
- The plan explains why V1 uses officer review instead of bot diagnosis.
- The plan aligns with Felix's feedback without overpromising AI diagnosis or farmer advisory output.

## Assumptions

- Issue #22 is an investigation ticket, so this branch should contain a planning document only.
- Disease reporting is tobacco-only for Kutsaga V1.
- Disease reports should reuse the existing reports and triage model unless implementation later proves that a new entity is necessary.
- Advisory output, Research Officer contact routing, Shona support, and image model training are related follow-up workstreams, not part of this issue's implementation.
- Kutsaga-approved advisory content is required before the bot gives pesticide, product, or control recommendations.
- Every disease report should be reviewed or surfaced to officers in V1, but only high-severity reports should receive stronger escalation treatment.
