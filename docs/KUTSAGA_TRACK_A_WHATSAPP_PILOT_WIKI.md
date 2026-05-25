# Kutsaga Track A WhatsApp Pilot Wiki

This wiki documents the Track A work for the Kutsaga pilot: adapting AgriData AI into a repeatable, multi-tenant, farmer-friendly WhatsApp reporting system for tobacco pest surveillance.

Track B, the aphid forecasting proof of concept, is owned separately by another developer. Track B focuses on ingesting historical aphid data, combining it with weather data, and producing exploratory forecasting outputs. Track A does not implement forecasting; it builds the real-time field data infrastructure that can later support forecasting and early-warning systems.

## Track A Summary

Track A is the farmer data collection and dashboard visibility track.

Goal:

- Onboard Kutsaga Research Board as a separate organization.
- Allow pre-registered Kutsaga farmer/reporting users to submit WhatsApp pest reports.
- Capture structured, geo-referenced, image-capable field observations.
- Display Kutsaga reports in the dashboard under the Kutsaga organization.
- Avoid leaking MPBC branding, data, or assumptions into Kutsaga flows.
- Make the onboarding work reusable for future organizations.

Current status:

- Kutsaga organization exists locally.
- Kutsaga pest config seed exists.
- Kutsaga officer/farmer-style WhatsApp reporting has been tested end to end.
- A Kutsaga report was successfully submitted and appeared in the dashboard.
- Invite flow fixes are in progress/implemented to support robust org admin onboarding.

## Strategic Context

The Kutsaga relationship changed from a forecasting-first collaboration into a data-infrastructure-first pilot.

Original expectation:

```text
existing historical data -> forecasting models
```

Updated direction:

```text
real-time structured data infrastructure -> better datasets -> future forecasting
```

Reason for the shift:

- Kutsaga's historical data is fragmented.
- Much of the historical data is paper-based, legacy, or hard to extract.
- Many records are not geo-referenced.
- Historical quality and consistency are not enough to rely on forecasting alone.

This makes Track A important because it creates the future dataset needed for stronger forecasting and early-warning work.

## Track Split

Track A:

- Farmer WhatsApp reporting.
- Kutsaga organization setup.
- Multi-tenant onboarding readiness.
- Pest configuration for Kutsaga tobacco pilot.
- Dashboard visibility for Kutsaga reports.
- Invite/admin access flows.

Track B:

- Aphid historical dataset ingestion.
- Weather data integration.
- Exploratory forecasting.
- Trend/projection outputs.
- Presentation-ready forecasting summaries.

Track A and Track B are related but intentionally decoupled for now. Forecasting outputs should not block the farmer reporting pilot.

## Kutsaga Communication Timeline

### Initial Context

Kutsaga shared a survey questionnaire named `Cluster Survey Questionnaires Final.docx`.

Message from Kutsaga:

```text
Good morning Agridata AI Team, as promised, find attached sample of survey questions we use when we interact with farmers.
```

The questionnaire covers:

- Farmer demographics.
- Consent and ethical participation wording.
- Tobacco diseases and pest sections.
- Mealybug.
- Angular leaf spot.
- Pythium root rot.
- Tobacco barn facilities and curing efficiency.

Decision:

- Treat the questionnaire as source material, not as the literal WhatsApp flow.
- The questionnaire is too broad and retrospective for a first WhatsApp pilot.
- The first pilot should focus on short, real-time pest observation reporting.

### Clarification Message Sent To Felix

We asked Felix:

```text
Hey Felix, thanks again for sharing the survey questions. We really appreciate the context, it helps us understand how Kutsaga currently interacts with farmers and what information is important to capture.

As we prepare the WhatsApp pilot flow, we wanted to clarify a few points so that we design the reporting process correctly:
1. What crop or crop category should the first pilot focus on? Given Kutsaga's mandate and the survey context, should we treat tobacco as the initial crop scope?
2. We noted the initial pests shared as Aphids, Mealybug, Budworm, and Falsewire worm. Please confirm if this is the correct starting set for the pilot.
3. For each of these pests, does Kutsaga already have a standard field data collection flow? For example: specific questions, count ranges, severity categories, symptoms, photo requirements, location, or notes.
4. If not, we can propose a simple farmer-friendly WhatsApp flow for your review.

As a starting point, we are thinking of a simple flow like:
1. Farmer selects the pest observed
2. Farmer answers 2-4 short pest-specific questions
3. Farmer optionally uploads a photo
4. Farmer shares their location
5. Farmer submits the report

The pest-specific questions could cover things like:
- approximate pest count or severity
- where the pest was observed
- visible symptoms or crop damage
- any action already taken by the farmer

Our goal is to keep the pilot simple enough for farmers to use easily, while still capturing useful structured data for Kutsaga.
Please let us know what information is essential to capture for each pest, and what can remain optional for the pilot.
```

### Felix Response

Felix responded:

```text
hey Agridata Team let me try to answer your questions as best as i can
1. for now lets keep the focus on Tobacco and we can always expand to other crops at a later stage
2. yes lets start with those pests they are the ones that are most common
3. Data collection for these pests is almost non existant however we do have our own count ranges, symptoms and if you need photos i can share with you photos of both the pests and the damage that they cause
4. looking at the objectives and goals of the pilot you want to run I do not see any problem with it remember most of our farmers are not very technical so your suggestions make sense, i think lets see what you come up with and make refinements from that.
```

Confirmed:

- First pilot crop: tobacco.
- First pest set: Aphids, Mealybug, Budworm, Falsewire worm.
- Existing structured collection flow: almost non-existent.
- Kutsaga has count ranges and symptoms.
- Kutsaga can share pest and damage photos.
- Kutsaga approves a simple farmer-friendly draft flow for refinement.

### Pest Rating Scales From Felix

Felix later shared pest/damage photos and the following rating scales.

Aphids:

```text
0: no aphids
1: 1-10 aphids
2: 11-100 aphids
3: 101-1000 aphids
4: 1000+ aphids
```

Budworm:

```text
0: no damage
1: >25% of leaves around the bud damaged
2: 25%-50% of leaves around the bud damaged
3: 51%-75% of leaves around the bud damaged
4: 76%-100% of leaves around the bud damaged
5: bud completely damaged
```

Note: the `1: >25%` label may mean less than 25% based on the rest of the scale. This should be confirmed with Kutsaga.

Mealybug:

```text
0: no mealybugs
1: 1-10 mealybugs
2: 11-50 mealybugs
3: 51-100 mealybugs
4: 100+ mealybugs
```

False wireworm:

```text
0: 0% stem damage
1: 25% stem damage
2: 50% stem damage
3: 75% stem damage
4: 100% stem damage (damage right around the stem)
```

Felix also clarified that aphids and mealybugs are sap-sucking insects, so their damage is not always visually obvious. For these pests, the flow should rely mainly on counts. In heavy infestations, farmers may see black sooty mould on leaves.

### Draft Severity Mapping

These are implementation draft thresholds pending Felix confirmation:

| Pest | Normal | Warning | High |
| --- | --- | --- | --- |
| Aphids | 0-1 | 2 | 3-4 |
| Mealybug | 0-1 | 2 | 3-4 |
| Budworm | 0-1 | 2-3 | 4-5 |
| False wireworm | 0-1 | 2 | 3-4 |

Implementation note:

- The WhatsApp flow captures the exact Kutsaga rating label.
- Severity is computed from that rating label using pest severity rules.
- These thresholds should be refined if Kutsaga interprets risk differently.
- Farmer-facing options should not repeat the numeric rating code because WhatsApp already numbers choices. For example, show `1 — 10 aphids`, not `1. 1-10 aphids`.
- Farmer-facing wording should use simple English. For example, use `How many aphids can you see on the leaves?` instead of `Estimate aphids seen on the leaves.`
- Yes/no questions should use numbered choices (`Yes`, `No`) instead of free text wherever possible.

## Current Draft WhatsApp Flow

The draft Track A flow is:

1. Farmer sends a message to the bot.
2. Bot shows the Kutsaga pest list.
3. Farmer selects a pest.
4. Farmer answers 2-4 short pest-specific questions.
5. Farmer optionally uploads a photo.
6. Farmer shares GPS location.
7. Bot submits the report.
8. Report appears in the dashboard under Kutsaga.

Draft pest-specific field categories:

- Approximate count or severity range.
- Where the pest was observed.
- Visible symptoms or crop damage.
- Any action already taken by the farmer.
- Optional photo.
- GPS location.

Current seeded v1 fields are intentionally simple because Kutsaga still needs to provide exact count ranges and symptoms.
The seed now uses Felix's rating scales for the four confirmed pests. The remaining uncertainty is severity interpretation, not the rating scale itself.

## Implementation Work Completed

### Multi-Tenant Readiness Planning

Created:

- `docs/MULTI_TENANT_ONBOARDING_READINESS_PLAN.md`

Purpose:

- Document the current multi-tenant gaps.
- Define the target outcome for repeatable org onboarding.
- Capture Kutsaga onboarding context.
- Track implementation phases and open decisions.

### Organization Lifecycle Status

Added organization status support:

- `DRAFT`
- `CONFIGURING`
- `READY_FOR_TEST`
- `ACTIVE`
- `SUSPENDED`

Migration:

- `drizzle/0010_add_organization_status.sql`

Purpose:

- New orgs should not silently behave as fully live.
- Super admins should be able to see where each org is in onboarding.
- Future readiness checks can gate activation.

### Organization Readiness Checks

Added readiness checks in the organizations router.

Current checks:

- At least one active org admin.
- At least one active WhatsApp reporter.
- At least one active pest configuration.
- Pest flow has questions and severity rules.

Purpose:

- Make it visible when a new org is missing setup.
- Avoid the failure mode where a new org has users but no reportable workflow.

### Admin Organization Readiness UI

Updated the admin Organizations page to show:

- Organization status.
- Readiness status.
- Missing setup items.

This makes onboarding state visible without inspecting the database.

### Kutsaga Pest Configuration Seed

Added:

- `scripts/seed-kutsaga-placeholder-configs.ts`
- `npm run seed:kutsaga-placeholder`

Although the command name still says placeholder, the seed contents now represent the draft Kutsaga tobacco pilot v1.

Seeded pests:

- Aphids
- Mealybug
- Budworm
- Falsewire worm

Each pest has:

- Field observation method.
- Short farmer-facing questions.
- Categorical severity/damage levels.
- Basic severity rules.

Decision:

- Keep this as editable configuration.
- Replace/refine questions once Kutsaga sends exact count ranges, symptoms, and reference photos.

### Organization Branding Isolation

Issue found:

- A Kutsaga reporter saw `This is the MPBC Pest Monitoring system`.
- The pest list was Kutsaga-specific, so the data path was correct.
- The copy was hard-coded inside the shared pest config processor.

Fix:

- Pass the organization name into the pest config processor.
- Use tenant-neutral copy:

```text
This is the Kutsaga Research Board reporting system.
```

Also changed the config-driven workflow id from MPBC-specific naming to a neutral `multi_pest_config` value for new reports.

### Twilio Investigation

Symptom:

- Inbound webhook worked.
- Bot generated messages.
- Phone received no WhatsApp reply.
- Logs showed `Twilio Error: Authenticate`, `401`, `20003`.

Findings:

- The webhook/ngrok path was not the issue.
- `NEXT_PUBLIC_APP_URL` was not the cause.
- The Twilio account was suspended due to lack of funds.
- Once the owner paid, outbound WhatsApp sends worked again.

Code hardening:

- Normalized WhatsApp sender/recipient formatting so `TWILIO_PHONE_NUMBER` can safely be either `+...` or `whatsapp:+...`.

Important security note:

- Twilio token was exposed during debugging. It should be rotated.

### End-To-End Kutsaga Reporting Test

Validated:

- Kutsaga reporter can message the bot.
- Bot shows Kutsaga pests.
- Reporter can complete a flow.
- Report appears in the dashboard under Kutsaga.

This is the strongest signal that Track A is working at the pilot-infrastructure level.

### Invite Flow Hardening

Issues found:

- Org admin invite links could fail depending on Supabase link format.
- Deleting a failed invite removed only `app_users`, not the Supabase Auth user.
- Re-inviting the same email could fail with `User is already registered and confirmed`.
- Resend invite failed for users who had become confirmed in Supabase but were still pending in our app.

Fixes:

- Invite redirects now go through `/auth/callback?next=/accept-invite`.
- `/auth/callback` now forwards hash-token invite links to `/accept-invite` instead of `/error`.
- Resend can generate a password setup/recovery link for confirmed-but-pending auth users.
- User deletion now removes the Supabase Auth user for dashboard users before deleting the internal app user.
- Delete dialog warns that dashboard users are also removed from Supabase Auth.

Authorization decision:

- Super admins can invite org admins and officers.
- Org admins can only invite officers into their own organization.
- No one can invite super admins through the normal org invite flow.

## Current Decisions

- Kutsaga is its own organization, not an MPBC variant.
- Kutsaga Track A is tobacco-only for the first pilot.
- The first Kutsaga pest set is Aphids, Mealybug, Budworm, and Falsewire worm.
- The first flow should be short and farmer-friendly.
- Farmers/reporters are WhatsApp-only for now.
- Farmers do not need dashboard access.
- Existing dashboard views are sufficient for the first pilot.
- Forecasting is out of scope for Track A.
- Kutsaga-specific flow should remain config-driven and easy to edit.
- Tenant branding must not leak across organizations.

## Open Items

Kutsaga content:

- Get count ranges for each pest.
- Get symptom lists for each pest.
- Get pest and damage reference photos.
- Confirm if any action-taken question is required in v1.
- Confirm whether aphids should appear in both Track A reporting and Track B forecasting demos.

Product/ops:

- Define pilot success metrics with stakeholders.
- Confirm number of pilot farmers.
- Confirm Kutsaga org admin contacts.
- Confirm support/escalation process during pilot.
- Decide whether consent wording should be first-use only or shown every report.
- Decide whether farmer reporters need a distinct `farmer` user type or whether `officer` remains acceptable for v1.

Technical:

- Rename the Kutsaga seed script/command from placeholder to pilot when convenient.
- Add tenant boundary tests.
- Add readiness tests.
- Add a more complete onboarding wizard.
- Consider database row-level security.
- Consider configuration history/audit logging.

## Suggested Next Message To Felix

```text
Thanks Felix, this is very helpful.

We will proceed with tobacco as the initial crop scope and Aphids, Mealybug, Budworm, and Falsewire worm as the first pest set.

Since there is no existing structured collection flow, we will draft a simple farmer-friendly WhatsApp flow for each pest and share it with you for review. We will keep it short so farmers can complete reports easily.

Please do share the count ranges and key symptoms you use for each pest. Photos of the pests and the crop damage would also be very useful, especially for helping us design clearer prompts and future farmer guidance.

Our first draft will likely capture:
- pest observed
- approximate count or severity range
- visible symptoms/damage
- where it was observed
- optional photo
- location

Once we prepare the draft flow, we can send it back to you for refinement before pilot testing.
```

## Current Status Summary

Track A is no longer blocked by Kutsaga's missing detailed pest questions.

The platform now has:

- Kutsaga org setup.
- Draft tobacco pest reporting configuration.
- Working WhatsApp reporting path.
- Dashboard visibility for Kutsaga reports.
- Improved multi-tenant readiness foundations.
- Improved invite/admin onboarding flows.

The next major step is content refinement: replace draft severity/symptom fields with Kutsaga-provided count ranges, symptoms, and photos.
