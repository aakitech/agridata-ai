# Branching and Release

**Status:** Draft  
**Last Updated:** June 2, 2026

Keep feature work isolated and reviewable.

## Branching

- Use `main` as the production-aligned base.
- Use focused branches, preferably with the `codex/` prefix for Codex-generated work.
- Use separate branches for unrelated workstreams, for example PostHog, docs cleanup, Kutsaga planning, or dashboard prototypes.
- Do not mix product code, migrations, and documentation cleanup unless they are part of the same change.

## Pull Requests

Each PR should explain:

- what changed
- why it changed
- user or developer impact
- validation performed
- linked issues or PRDs

Draft PRs are preferred for planning branches and early implementation branches.

## Release Guardrails

- Run typecheck/build/tests appropriate to the change before merge.
- Keep production-affecting migrations explicit and reviewed.
- Use feature flags for experimental dashboard behavior.
- Keep Product Lab routes disabled by default in production.

