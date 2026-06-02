# Testing Strategy

**Status:** Draft  
**Last Updated:** June 2, 2026

The testing strategy is emerging. The project has Vitest configured and should grow tests around the code paths that protect data quality, tenant isolation, and operational reliability.

## Priorities

Test these areas first:

- WhatsApp workflow state transitions.
- Pest configuration processing and severity calculation.
- Report creation and persistence.
- Organization and role-based data isolation.
- Alert generation and priority rules.
- Triage status and notes behavior.
- Feature flag and Product Lab access gates.
- Observability sanitization so sensitive report content is not captured.

## Test Types

- Unit tests for pure rules and service helpers.
- Service tests for module behavior with controlled data.
- Router tests for permission and input validation boundaries.
- Smoke tests for critical flows: login, dashboard load, WhatsApp report submission, report visibility.

## TDD Rule Of Thumb

Use test-first development for production behavior changes, bug fixes, and refactors that affect business logic. Prototype-only lab UI can be explored more loosely, but production promotion should include tests.

