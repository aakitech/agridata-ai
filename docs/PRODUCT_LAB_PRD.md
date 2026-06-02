# Product Requirements Document - Internal Product Lab

**Version:** v0.1  
**Last Updated:** June 2, 2026  
**Status:** Draft for planning  

## Overview

Create an internal, gated Product Lab where the team can prototype dashboard workflows before promoting them into production features.

Initial prototype areas:

- Notifications and escalation queues.
- Report triage dashboards.
- Report detail and visibility improvements.
- Organization-specific report output templates.

## Goals

- Provide a safe place to test product ideas in the real app context.
- Prevent prototype code from leaking into normal user workflows.
- Use mock data by default.
- Define a clear promotion path from prototype to production feature.

## Non-Goals

- Do not expose lab pages to normal organization users.
- Do not write prototype actions to production tables.
- Do not treat lab UI as production-ready implementation.

## Safety Rules

- Lab routes live under `/dashboard/lab`.
- Lab access requires a feature flag, for example `ENABLE_PRODUCT_LAB=true`.
- Lab access also requires an internal/super-admin role.
- Production defaults to lab disabled.
- Lab pages use mock data first.
- Any live data mode must be read-only and explicit.
- Prototype components are promoted into production only through a separate issue, implementation branch, tests, and PR.

## Suggested Route Shape

```text
/dashboard/lab
/dashboard/lab/notifications
/dashboard/lab/triage
/dashboard/lab/report-templates
```

## First Acceptance Criteria

- Product Lab route structure is agreed.
- Feature flag and role-gate strategy is agreed.
- Mock-data-only v1 rule is agreed.
- First three prototype areas are confirmed.
- Follow-up implementation tickets can be created.

