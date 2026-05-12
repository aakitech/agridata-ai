# Multi-Tenant Onboarding Readiness Plan

This document is the planning home for making AgriData AI production-ready for repeatable multi-tenant onboarding: a new organization should be creatable, configurable, invited, and operational without engineering/admin hand-holding.

It also captures the emerging Kutsaga onboarding context. There is no current Kutsaga-specific context in the codebase, so this section starts as an intake/update area and should be filled in as the partnership and operating model become clearer.

## Current State

The system is already tenant-aware:

- Organizations exist as first-class records.
- Users belong to an organization through `app_users.org_id`.
- Reports, weather records, pest configurations, and alert thresholds are tied to organizations.
- Role behavior is split between `super_admin`, `org_admin`, and `officer`.
- Most dashboard reads scope org admins to their own organization while allowing super admins to view across organizations.
- WhatsApp ingestion identifies an officer by phone number, resolves their organization, and runs the active org-specific pest workflow/configuration.

The system is not yet fully repeatable or self-service:

- New organizations can be created, but they do not receive default workflows, pest configurations, alert thresholds, or readiness checks automatically.
- A new org without active pest configs or workflow config cannot collect reports over WhatsApp.
- Some reporting functionality is still MPBC-specific.
- Tenant isolation is enforced mostly in application code, not database row-level security.
- Onboarding steps are scattered across admin UI, scripts, and operational knowledge.

## Target Outcome

A new organization can be onboarded through a guided, repeatable flow:

1. Create organization.
2. Select or define an onboarding template.
3. Configure pest workflows, observation methods, severity rules, alert thresholds, and reporting settings.
4. Invite the first org admin.
5. Add field officers.
6. Verify WhatsApp collection end to end.
7. Verify dashboard/report visibility and tenant isolation.
8. Mark the organization as operational.

The goal is not just to make onboarding possible. The goal is to make it boring, auditable, and safe.

## Proposed Phases

### Phase 1: Document and Codify the Runbook

Create a formal onboarding checklist for pilots and production orgs.

Deliverables:

- New-org intake checklist.
- Required operational data fields.
- Manual onboarding runbook using today's admin UI and scripts.
- Definition of "operational" for an org.
- Failure/recovery checklist for common onboarding issues.

Key questions:

- Who is allowed to create a production org?
- Who signs off on pest workflow content?
- Who owns field officer lists and phone number accuracy?
- What support channel does a new org use after go-live?

### Phase 2: Onboarding Templates

Introduce reusable templates so a new org does not start from a blank configuration.

Deliverables:

- Template model for pest configurations, observation methods, prompts, severity rules, and alert triggers.
- Ability to clone a template into a new organization.
- Seed/default template for MPBC-style multi-pest surveillance.
- Kutsaga-specific template once requirements are clear.
- Template versioning notes so existing orgs are not silently changed when templates evolve.

Initial template types:

- `multi_pest_surveillance`
- `pheromone_trap_monitoring`
- `field_observation`
- `custom_partner_template`

### Phase 3: Guided Admin Onboarding Flow

Build a super-admin onboarding flow that replaces one-off setup knowledge.

Deliverables:

- Create organization wizard.
- Slug validation and collision handling.
- Template selection step.
- Org admin invite step.
- Field officer import/add step.
- Alert threshold review step.
- Readiness summary before activation.

Important behavior:

- A newly created org should have a clear status, such as `DRAFT`, `CONFIGURING`, `READY_FOR_TEST`, `ACTIVE`, or `SUSPENDED`.
- The org should not be considered live until required checks pass.
- Super admins should be able to see what is missing for each org.

### Phase 4: Org Readiness Checks

Add automated checks that answer: "Can this org actually operate today?"

Checks:

- Organization exists and is active.
- At least one org admin exists and can log in.
- At least one active officer exists with a valid international phone number.
- At least one active pest configuration or active workflow exists.
- Pest configs have observation methods, fields, and severity rules.
- Alert thresholds or alert trigger rules are present where required.
- WhatsApp test user can complete a report.
- Report appears in dashboard scoped to the org.
- Super admin can filter/report on the org.
- Org admin cannot see other orgs.

Deliverables:

- Readiness endpoint.
- Admin UI readiness panel.
- Human-readable failure messages.
- Optional "mark active" mutation gated by readiness checks.

### Phase 5: Tenant Isolation Hardening

Reduce the risk that future code accidentally leaks cross-org data.

Deliverables:

- Central tenant-scoping helpers for routers/services.
- Tests for org admin access boundaries.
- Tests for invite and user-management boundaries.
- Tests for report, analytics, triage, enhancement, weather, and pest config boundaries.
- Review whether Supabase/Postgres row-level security should be enabled for tenant-owned tables.
- Audit and fix endpoints that currently rely on convention rather than enforced scope.

Known item:

- Invite resend should verify that an org admin is resending an invite only for a user in their organization.

### Phase 6: Reporting Generalization

Remove or isolate MPBC-specific assumptions so other orgs can use reports.

Deliverables:

- Separate generic report generation from MPBC-branded report generation.
- Add org-level report settings.
- Support partner-specific report templates when needed.
- Keep MPBC weekly report behavior available without making it the default path for every org.

### Phase 7: Operational Tooling

Make onboarding and support observable.

Deliverables:

- Org onboarding audit log.
- Invite status visibility.
- Officer status and last WhatsApp activity.
- Latest successful report per org.
- Configuration change history for pest configs and thresholds.
- Support/debug screen for super admins.

## Kutsaga Intake / Update

Status: pre-execution transition phase.

Known so far:

- Kutsaga Research Board is a new institutional partner we may onboard.
- There is currently no Kutsaga-specific code or data reference in the repository.
- Kutsaga appears to be tobacco-focused, but this should be confirmed directly with stakeholders before implementation.
- Kutsaga's immediate need is a real-time, structured agricultural data collection system, not a forecasting product alone.
- The relationship shifted from "use existing historical data to forecast" toward "build high-quality real-time data infrastructure that can later support forecasting and early warning."
- Track A is the farmer WhatsApp data collection pilot.
- Track B is the aphid forecasting proof of concept and is being handled separately.

Strategic context:

- Kutsaga originally expected historical pest, weather, and agronomic datasets to support forecasting validation.
- Deeper discussions revealed fragmented historical data, paper-based records, legacy systems, limited geo-referencing, and inconsistent data quality.
- Aphids remain strategically important because Kutsaga reportedly has 5-10 years of relatively clean aphid trap data.
- The immediate Track A pilot should prove real-time reporting, structured data generation, geo-referenced observations, and dashboard visibility.
- Forecasting should remain out of scope for Track A unless the forecasting team explicitly provides outputs ready for dashboard integration.

Track A pilot assumptions:

- Initial reporters are farmers.
- Farmers are WhatsApp-only users and do not need dashboard access.
- Farmers should be pre-registered similarly to the MPBC officer flow.
- The first pilot can start in English.
- The operating style should remain close to MPBC: collect reports, show them in the dashboard, and keep the current triage/admin model unless Kutsaga asks for a different review process.
- The existing dashboard is acceptable for the first pass; expand only when Kutsaga explicitly asks for new views.
- Pilot success metrics still need stakeholder discussion.
- Consent and data-use wording should be added because farmers will send location and possibly images.

Initial pest set shared by Kutsaga:

- Aphids
- Mealybug
- Budworm
- Falsewire worm

Questionnaire artifact:

- Kutsaga shared `Cluster Survey Questionnaires Final.docx` as sample survey questions used when interacting with farmers.
- The document is broad and includes demographics, consent language, tobacco disease sections, mealybug, angular leaf spot, pythium root rot, and tobacco barn facilities/curing efficiency.
- It should be treated as source material for domain language and possible future survey modules, not as the literal first WhatsApp reporting flow.
- The first WhatsApp flow should be much shorter than the questionnaire and should focus on real-time incident/observation reporting.

Information to capture:

- Official organization name and preferred short name.
- Primary contacts and roles.
- Intended pilot/live start date.
- Confirmed crop scope, especially whether Track A is tobacco-only.
- Confirmed pests, diseases, or surveillance categories in scope for the first WhatsApp pilot.
- Whether aphids are included in Track A reporting, Track B forecasting only, or both.
- Geographic operating area.
- Number of org admins.
- Number of field officers.
- Number of farmer reporters.
- WhatsApp reporting requirements.
- Dashboard/reporting expectations.
- Whether Kutsaga needs MPBC-like pest surveillance or a different workflow.
- Whether Kutsaga needs branded reports, generic reports, or no PDF reports initially.
- Data ownership, visibility, and export requirements.
- Support and escalation process.
- Consent/privacy wording required before farmers submit location or images.

Draft Kutsaga onboarding assumptions:

- Kutsaga should be modeled as its own organization record, not as an MPBC variant.
- Kutsaga should receive its own pest/workflow configuration.
- Kutsaga org admins should only see Kutsaga data.
- Super admins should be able to compare or filter Kutsaga alongside other organizations.
- Kutsaga-specific configuration should be template-driven so future similar orgs can reuse it.
- Kutsaga farmer reporters may require a new user type or metadata field if they should be distinguished from MPBC-style field officers.

## Initial Implementation Backlog

Priority 1:

- Add org lifecycle/status fields.
- Add onboarding/readiness checklist document and manual runbook.
- Add tenant boundary tests around existing org-scoped routes.
- Fix invite resend org authorization.
- Add "new org has no workflow/config" warning in admin UI.

Priority 2:

- Add onboarding template model.
- Add template clone action for pest configurations.
- Add readiness endpoint.
- Add admin readiness panel.
- Add generic report settings at org level.

Priority 3:

- Add full guided onboarding wizard.
- Add org configuration audit log.
- Add template versioning.
- Evaluate and optionally add database RLS.
- Generalize MPBC-specific PDF/report logic into pluggable report templates.

## Open Decisions

- Should new org creation remain super-admin only, or should invited org admins be able to start a request?
- Do we want database RLS in addition to application-level tenant scoping?
- Should templates live in code, database, or both?
- Should each org have a single active workflow, multiple active workflows, or only pest configurations going forward?
- What org states should block WhatsApp usage?
- What minimum readiness checks are required before an org can be marked active?
- How much of the Kutsaga setup should become a reusable template?

## Definition of Done

This plan is complete when:

- A super admin can onboard a new org through the app without touching scripts or code.
- The new org has active configuration before field officers use WhatsApp.
- The first org admin can log in and see only their organization.
- Field officers can submit WhatsApp reports that appear in the correct org dashboard.
- Readiness checks clearly show what is missing before go-live.
- Tenant isolation is covered by tests.
- MPBC-specific behavior does not block non-MPBC organizations.
