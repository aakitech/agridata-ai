# ZSAES WhatsApp Pest Surveillance Demo Implementation Plan

## Context

Zimbabwe Sugar Association Experiment Station (ZSAES) is the next organization being considered for AgriData onboarding after MPBC and Kutsaga.

ZSAES currently has a pest surveillance pain point that is similar to the other organizations: outbreak information can take too long to reach the responsible technical team, and by the time an officer attends to the issue in person, the outbreak may already be advanced.

ZSAES shared a proposal requesting a mobile and web-based application for pest scouting. The proposed AgriData demo should show that we can meet the core surveillance need through the existing WhatsApp reporting flow plus the dashboard, without requiring a separate native mobile application for the first phase.

## Source Proposal Summary

The ZSAES proposal asks for a system that can:
   
- Replace the current paper-based pest scouting system.
- Collect, store, analyze, and report pest surveillance data in real time.
- Support offline field use and synchronize when internet becomes available.
- Capture field scouting details:
  - Estate / area
  - Section
  - Field number
  - Farm size
  - Variety
  - Crop age
  - Irrigation type
  - Ratoon number
- Monitor key sugarcane pests and diseases:
  - Eldana saccharina
  - Yellow Sugarcane Aphid
  - RSD
  - Smut
  - Other emerging pests
- Support pest-specific scouting protocols.
- Generate automatic reports.
- Produce pest hotspot maps using GPS data.
- Store historical scouting records for trend analysis.
- Show dashboards with infestation levels and high-risk areas.
- Generate alerts when infestation thresholds are exceeded.
- Support access levels for scouts, entomologists, agronomists, and management.

## Proposed Demo Direction

For the demo, we should position AgriData as:

> A WhatsApp-first pest surveillance and outbreak reporting system for ZSAES, with dashboard visibility for technical teams and management.

The demo should not try to deliver the full mobile app requested in the proposal. It should also stay pest-only for the first ZSAES demo, because the current WhatsApp workflow and dashboard copy are pest-oriented and we need an internal decision on disease handling before introducing RSD or Smut.

Instead, the demo should show a practical first phase:

1. Field scouts submit structured sugarcane pest observations over WhatsApp.
2. Reports are stored under the ZSAES organization.
3. GPS location is captured from WhatsApp.
4. ZSAES admins can view reports on the dashboard.
5. Pest severity is computed from configured thresholds or categories.
6. Hotspot/map and report views show where issues are happening.
7. The same multi-tenant separation used for MPBC and Kutsaga applies to ZSAES.

## Organization Setup

Create a new organization. Use the short name as the app display name so the dashboard and WhatsApp copy match MPBC-style naming:

- Display name: `ZSAES`
- Full name/context: `Zimbabwe Sugar Association Experiment Station`
- Slug: `zsaes`
- Status for demo: `READY_FOR_TEST` or `ACTIVE` once users are added

ZSAES must be its own organization record, not an MPBC or Kutsaga variant.

Expected access model:

- `super_admin`: AakiTech internal admin across all organizations.
- `org_admin`: ZSAES admin or management user with dashboard access.
- `officer`: ZSAES scout/field reporter using WhatsApp.

The proposal mentions scouts, entomologists, agronomists, and management. The current app only has `super_admin`, `org_admin`, and `officer`, so for the demo we can map them as:

| ZSAES Role | Demo Mapping |
|---|---|
| Scout | `officer` |
| Entomologist | `org_admin` |
| Agronomist | `org_admin` |
| Management | `org_admin` |

More granular roles can be a post-demo enhancement.

## Proposed WhatsApp Flow

### Entry

```text
Hello {{OfficerName}}

This is the ZSAES sugarcane pest surveillance system.
Please select what you are reporting:

1. Eldana saccharina
2. Yellow Sugarcane Aphid
3. Other emerging pest
```

### Common Field Details

For the demo, each pest workflow should capture the same core sugarcane field context:

1. Estate / area
2. Section
3. Field number
4. Farm size
5. Variety
6. Crop age
7. Irrigation type
8. Ratoon number

Estate / area and irrigation type should use select options with an `Other` follow-up question. Section, field number, variety, and farm size can remain typed fields until ZSAES gives us official lists.

Current pest configuration supports pest-specific fields, so the first implementation can repeat these common fields inside each ZSAES pest config. Later, we can improve the workflow engine to support shared organization-level context fields before pest-specific questions.

### Eldana Saccharina Flow

The proposal gives Eldana as the clearest protocol example. Demo fields:

1. Estate / area
2. Section
3. Field number
4. Farm size
5. Variety
6. Crop age
7. Irrigation type
8. Ratoon number
9. Number of stalks inspected
10. Total number of internodes inspected
11. Number of stalks bored
12. Number of internodes bored
13. Eldana present?
14. Eldana count per stalk, if available
15. Optional photo
16. GPS location

Potential derived metrics:

- Percent stalks bored = `stalks_bored / stalks_inspected * 100`
- Percent internodes bored = `internodes_bored / internodes_inspected * 100`

For the demo, if derived severity is not fully supported in the runtime yet, we can start with simple numeric or categorical thresholds on:

- Number of stalks bored
- Number of internodes bored
- Eldana present

### Yellow Sugarcane Aphid Flow

The proposal does not provide a full aphid protocol. Demo fields should be simple and reviewable:

1. Common field details
2. Aphid infestation level
   - None
   - Low
   - Moderate
   - High
3. Plant part affected
   - Leaves
   - Stalk
   - Whole plant
4. Visible honeydew or sooty mould?
5. Optional photo
6. GPS location

### Other Emerging Pest Flow

Demo fields:

1. Common field details
2. Pest or symptom description
3. Estimated severity
   - Low
   - Moderate
   - High
4. Optional notes
5. Optional photo
6. GPS location

This is important for ZSAES because their proposal explicitly mentions other emerging pests.

## Dashboard Demo Scope

For the first demo, ZSAES should be able to see the same core capabilities already available to MPBC/Kutsaga:

- Dashboard summary scoped to ZSAES.
- Recent reports.
- Reports list.
- Map view / hotspot visibility using GPS.
- Pest distribution.
- Severity/risk indicators.
- Report generation, if enabled generically.
- Triage/detail view for expert follow-up.
- User management for ZSAES officers/admins.

Copy should be organization-neutral or ZSAES-specific. Avoid MPBC/Kutsaga wording leaking into the ZSAES dashboard.

## Implementation Plan

### Phase 1: Demo Configuration

Goal: show the ZSAES WhatsApp reporting flow and dashboard visibility without new architecture.

Tasks:

1. Create a ZSAES seed script similar to the Kutsaga seed script.
2. Create or update the `zsaes` organization.
3. Seed ZSAES pest/surveillance configurations:
   - Eldana saccharina
   - Yellow Sugarcane Aphid
   - Other emerging pest
4. Include common sugarcane field fields in each config, using select options plus `Other` follow-ups where we have safe placeholder values.
5. Add simple severity rules for demo purposes.
6. Add npm script for seeding ZSAES config.
7. Add the ZSAES seed step to preview/production deployment workflows only after it is reviewed.
8. Add a small internal test user/officer manually through dashboard or script.
9. Test the WhatsApp flow through the simulator and/or Twilio sandbox/live number.
10. Confirm reports appear under ZSAES only.

### Phase 2: Demo Hardening

Goal: make the demo strong enough for ZSAES review.

Tasks:

1. Refine prompts to use ZSAES terminology.
2. Confirm pest protocol wording with ZSAES.
3. Confirm threshold values for warning/high severity.
4. Confirm whether RSD and Smut need a separate disease workflow, dashboard copy, or future mobile/PWA module.
5. Verify PDF/report generation works for non-MPBC organizations.
6. Prepare a scripted demo path:
   - Add officer
   - Send Eldana report
   - Send Aphid report
   - View dashboard
   - View map/hotspot
   - Generate report

### Phase 3: Production Pilot Readiness

Goal: move from demo to real ZSAES pilot if they approve.

Tasks:

1. Onboard real ZSAES officers/scouts.
2. Invite ZSAES admin users.
3. Add confirmed threshold rules.
4. Add confirmed pest-specific protocols.
5. Decide whether offline support requires a dedicated mobile app later.
6. Add ZSAES-specific reports if generic reports are not enough.
7. Add granular roles only if ZSAES requires them.

## What We Can Reuse

Existing app capabilities that fit ZSAES:

- Multi-tenant organization model.
- Phone-number based WhatsApp officer registration.
- Config-driven pest/surveillance flows.
- Dynamic observation fields.
- Optional photo capture.
- WhatsApp GPS capture.
- Dashboard scoping by organization.
- Reports list and detail views.
- Map-based visibility.
- Severity rules and alerts.
- Generic report generation improvements added for Kutsaga/non-MPBC orgs.

## Likely Gaps

These are not blockers for a demo, but they matter for a full production pilot:

1. Offline support
   - WhatsApp works well when the user has connectivity, but it is not a true offline mobile app.
   - If ZSAES needs offline-first scouting, that is a future mobile/PWA requirement.

2. Shared field context
   - Estate/section/field metadata should ideally be captured once and reused across pest flows.
   - Current config model can support this by repeating fields per pest, but that is not elegant long term.

3. Derived metrics
   - Eldana protocols need percentage calculations for bored stalks/internodes.
   - The database has space for derived definitions, but we need to confirm runtime support before relying on it.

4. Disease category handling
   - RSD and Smut are diseases, not pests.
   - They are intentionally excluded from the first pest-only demo.
   - The team needs to decide whether disease reporting should use a separate workflow, category, dashboard copy, or future mobile/PWA module.

5. Estate/field master data
   - The proposal implies structured estate/section/field data.
   - Demo can use text inputs or simple select lists.
   - Production may need a proper field registry.

6. Role granularity
   - ZSAES asked for scouts, entomologists, agronomists, and management.
   - Current roles are simpler. This is acceptable for demo, but may need expansion later.

## Clarification Questions For ZSAES

### Organization And Users

1. What exact organization name should appear in the system?
2. Should the short name be `ZSAES`?
3. Who should be the first dashboard admin?
4. Who should test the WhatsApp flow first?
5. Should scouts only submit reports, or should they also view any dashboard data?

### Field Metadata

1. What estates should appear in the demo?
2. Should section and field number be free text or selected from a list?
3. What varieties should be available?
4. How should crop age be captured: months, years, or planting date?
5. What irrigation types should be listed?
6. What ratoon number range should be allowed?

### Pest Protocols

1. For Eldana, what are the official scouting thresholds for normal, warning, and high?
2. Should severity be based on stalks bored, internodes bored, Eldana count, or a derived percentage?
3. What is the official scouting protocol for Yellow Sugarcane Aphid?
4. How should "Other emerging pest" reports be reviewed or categorized?

### Disease Handling

1. How should AgriData support sugarcane diseases such as RSD and Smut?
2. Should disease reporting use a separate workflow, category, dashboard copy, or future mobile/PWA module?
3. Should disease reporting be part of a later ZSAES pilot phase after the pest-only demo?

### Dashboard And Reporting

1. What reports do they expect daily, weekly, and monthly?
2. Should reports be PDF, dashboard-only, Excel/CSV, or all of these?
3. Who receives alerts when thresholds are exceeded?
4. Should alerts go through WhatsApp, email, dashboard, or all?
5. What dashboard views matter most for the demo?

### Offline Requirement

1. Is WhatsApp acceptable for the first phase even though it is not fully offline-first?
2. Do scouts usually have intermittent connectivity or no connectivity for long periods?
3. Would "send when network returns" through WhatsApp be acceptable for the pilot?

## Recommended Demo Acceptance Criteria

The ZSAES demo is ready when:

1. ZSAES exists as its own organization.
2. At least one ZSAES officer can submit a WhatsApp report.
3. The flow captures sugarcane field metadata.
4. The WhatsApp menu contains only pest-reporting options for the demo.
5. Eldana reporting captures the core protocol fields from the proposal.
6. GPS location is captured.
7. Optional photo capture works.
8. The report appears in the dashboard under ZSAES only.
9. The map shows the report location.
10. Severity is computed from configured demo thresholds.
11. A ZSAES admin can log in and view the dashboard.

## Recommendation

For the demo, build ZSAES using the same config-driven WhatsApp flow pattern as Kutsaga. Keep the first demo pest-only and do not build a separate mobile app yet.

The demo should prove that AgriData can digitize ZSAES pest surveillance quickly through WhatsApp and dashboard visibility. After the demo, we can decide whether their offline and role requirements justify a larger mobile/PWA phase.
