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
-> chooses Pest/Insect, Disease/Symptom, or Other/Not sure
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
What are you reporting?
1. Pest/insect problem
2. Disease/symptom problem
3. Other / not sure
```

For V1, farmers should not be required to know or select a disease name. They should describe what they see.

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
- Inconclusive / needs more information: useful future state, but may require follow-up messaging support.

Reviewed outcomes should update the dashboard status first. Farmer-facing follow-up should be handled by the advisory/follow-up messaging workstream unless approved advisory content and messaging rules are ready.

## Dashboard Recommendation

Use existing reports and triage surfaces for V1 instead of creating a new disease dashboard.

Recommended dashboard behavior:

```text
Disease report submitted
-> appears in reports dashboard
-> category shown as Disease/Symptom
-> status starts as Pending Review / Pending Triage
-> officer/admin can open report details
-> symptom fields are shown clearly
-> high severity disease reports trigger dashboard alert/escalation
```

The dashboard should avoid pest-only labels for disease reports. Examples:

- Use `Disease/Symptom` instead of `Pest` where appropriate.
- Use `Symptoms` or `Primary observation` instead of `Primary pest value`.
- Show captured symptom fields as a structured summary.
- Keep reviewed outcomes internal until follow-up messaging is implemented.

Suggested V1 severity mapping can be based on spread:

```text
One/few plants -> Normal / Low
Several plants -> Warning
Many plants -> High
Most of the field -> High
Not sure -> Pending Review, no alert unless another high-risk signal exists
```

Only high-severity disease reports should trigger dashboard alerts or escalation in V1. Low and medium reports should still enter the review queue without urgent alerting.

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
- `diagnosis`, `riskLevel`, `verifiedAt`, `verifiedBy`: populated during officer review

If implementation shows that `category = DISEASE` is not currently supported by the enum or UI, add it as a focused schema/UI change rather than creating a separate disease report table.

Do not create a separate disease report entity in V1 unless the existing reports model blocks core behavior.

## Implementation Tickets To Create

1. Add Kutsaga pest vs disease entry point to WhatsApp flow.
2. Add generic Kutsaga disease diagnostic question configuration.
3. Store disease reports in the existing report structure with `category = DISEASE`.
4. Generalize report/dashboard labels from pest-only to report-type-aware copy.
5. Show disease symptom fields clearly in report details and triage.
6. Add high-severity disease alert/escalation behavior based on spread.
7. Add optional disease image guidance copy.
8. Defer farmer advisory and WhatsApp follow-up messaging to separate issues.

## Validation Plan

This issue should be complete when:

- The current workflow architecture has been reviewed.
- The recommended data model approach is documented.
- The V1 disease question list is documented.
- The alerting/escalation dependency is identified.
- Follow-up implementation tickets are split from this investigation.
- The plan explains why V1 uses officer review instead of bot diagnosis.
- The plan aligns with Felix's feedback without overpromising AI diagnosis or farmer advisory output.

## Assumptions

- Issue #22 is an investigation ticket, so this branch should contain a planning document only.
- Disease reporting is tobacco-only for Kutsaga V1.
- Disease reports should reuse the existing reports and triage model unless implementation later proves that a new entity is necessary.
- Advisory output, Research Officer contact routing, Shona support, and image model training are related follow-up workstreams, not part of this issue's implementation.
- Kutsaga-approved advisory content is required before the bot gives pesticide, product, or control recommendations.
