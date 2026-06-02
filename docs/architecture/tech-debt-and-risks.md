# Tech Debt and Risks

**Status:** Draft  
**Last Updated:** June 2, 2026

This file tracks durable engineering risks that affect codebase health. Use GitHub issues for active remediation tasks.

## Current Risk Areas

### Webhook and API Abuse Protection

Twilio signature validation exists for production webhook requests. The remaining concern is rate limiting for public API/webhook surfaces.

Risk:

- repeated webhook/API traffic could create operational load or abuse costs

### Media Upload Hardening

The media service maps content types and stores report media, but does not yet verify file signatures or enforce explicit file size limits.

Risk:

- unexpected or oversized media could increase storage cost or security exposure

### Sensitive Logging

Some logs still include phone numbers, inbound message bodies, Twilio media URLs, emails, or request metadata.

Risk:

- operational logs could expose sensitive reporter or institutional data

### Phone Number Normalization

Phone numbers are normalized by trimming and removing whitespace. Full E.164 validation is not yet consistently enforced.

Risk:

- inconsistent phone formats can cause onboarding, lookup, or tenant-routing issues

### Tenant Isolation Enforcement

Tenant isolation is mostly enforced in application code. Stronger central helpers and tests are still needed as modules grow.

Risk:

- future features may accidentally omit organization scoping

