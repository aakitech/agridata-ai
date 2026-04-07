# MPBC Multi-Pest Scope Lock Note
**Version:** 1.0.0  
**Status:** Accepted  
**Last Updated:** March 25, 2026  
**Purpose:** Confirm the minimum scope decisions required before implementation of the v2.1 multi-pest configuration system begins.

## 1. Why This Exists
The v2.1 spec is strong enough to begin implementation, but a few open decisions still affect the shape of the schema, WhatsApp runtime, and seed configuration model.

This note narrows those decisions to the smallest set that must be locked before we start coding.

The decisions below are accepted for phase-1 implementation.

## 2. Decisions To Lock
### 2.1 African Armyworm Monitoring Mode
Question:

- Is African Armyworm operationally trap-only, field-only, or both?

Recommended default for implementation:

- Treat African Armyworm as `PHEROMONE_TRAP` only for phase 1

Reason:

- This matches the current validated baseline
- It avoids blocking schema design on an unresolved operational question
- The schema will still support adding `FIELD_OBSERVATION` later without redesign

Impact:

- Phase 1 seed config includes only the trap workflow for African Armyworm
- The system schema still supports multiple methods from day one

### 2.2 First Rollout Pest Set
Question:

- Which pests should be active in the first implementation rollout?

Recommended default for implementation:

- Roll out all five currently in-scope pests:
  - African Armyworm
  - Locusts
  - Quelea Birds
  - Rodents
  - Whiteflies

Reason:

- These are the explicitly scoped pests in the v2.1 spec
- Designing the system around all five now avoids building a partial model and retrofitting immediately after

Impact:

- We seed config records for all five pests
- Some pest configs may start with simpler first-pass field sets if clarification is still pending

### 2.3 Observation Methods Enabled in Phase 1
Question:

- Which observation methods should each phase-1 pest support initially?

Recommended default for implementation:

- African Armyworm: `PHEROMONE_TRAP`
- Locusts: `EVENT_OBSERVATION`
- Quelea Birds: `EVENT_OBSERVATION`
- Rodents: `SIGN_BASED`
- Whiteflies: `FIELD_OBSERVATION`

Reason:

- This gives each pest one clear default method for first implementation
- It avoids introducing unnecessary officer branching in the first runtime version
- The schema still supports multi-method extension later

Impact:

- Phase 1 WhatsApp flow asks for pest selection but usually does not need a second method-selection question
- Multi-method runtime support can still be built now, but will be exercised initially only when needed

### 2.4 Input Style Policy
Question:

- Which pests require strict numeric input versus standardized bands in phase 1?

Recommended default for implementation:

- Strict numeric:
  - African Armyworm trap counts
  - Whiteflies sampled field counts where applicable
- Standardized bands or controlled options:
  - Locust event size or observation scale
  - Quelea flock size bands
  - Rodent activity level and trend

Reason:

- This follows the cofounder feedback to remove vague labels while still respecting pest types that do not map cleanly to precise counts

Impact:

- The field schema must support both `number` and `select`
- Severity rules must support both numeric and categorical logic

### 2.5 Weather Capture Policy
Question:

- Should weather remain a manual field in phase 1, or shift to system-enriched context by default?

Recommended default for implementation:

- Use system-enriched weather by default
- Allow only lightweight optional field-condition prompts where operationally valuable

Reason:

- This aligns with the v2.1 refinement
- It reduces officer friction and duplicated data capture

Impact:

- Weather should not be modeled as a universal required officer field
- The field schema should still allow optional contextual conditions like `Hot`, `Windy`, `Dry`, or `Recent rain`

### 2.6 Template Strategy
Question:

- Should pest configurations be global reusable templates or org-specific configs in phase 1?

Recommended default for implementation:

- Org-specific configurations only in phase 1

Reason:

- MPBC is the current implementation target
- This keeps schema and admin logic simpler
- Global templates can be layered in later if reuse becomes necessary

Impact:

- Seed data is written directly for the MPBC organization model
- No template inheritance or cross-org config distribution is required yet

## 3. Recommended Scope Lock
If we want the fastest safe path into implementation, we should lock the following:

1. African Armyworm is trap-only in phase 1
2. All five current pests are included in rollout scope
3. Each pest gets one primary observation method in phase 1
4. Numeric and categorical inputs are both allowed depending on pest
5. Weather is system-enriched by default
6. Configs are org-specific in phase 1

## 4. What This Unlocks
Once these decisions are accepted, we can move immediately to:

1. schema design
2. runtime config types
3. seed configuration design
4. codebase impact mapping

## 5. Outstanding Clarification That Can Be Deferred
The only major question that can remain open without blocking implementation is:

- whether African Armyworm should later gain a `FIELD_OBSERVATION` mode in addition to trap monitoring

Decision:

- Defer African Armyworm `FIELD_OBSERVATION` support to phase 2

Reason:

- The trap workflow is the validated baseline and should remain the only African Armyworm observation method in phase 1
- This keeps implementation focused while preserving schema support for future expansion
