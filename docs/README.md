# AgriData AI Docs

This folder is the central home for durable project documentation.

Keep repo docs lean. Use GitHub issues for active implementation discussions, investigation threads, and task tracking. Use the repo only for knowledge that should travel with the codebase.

## Active Areas

- [Architecture](architecture/README.md): how the system is built, how we keep it healthy, and how we operate releases.
- [ADRs](adr/README.md): durable decisions and the reasoning behind them.
- [Product](product/overview.md): product context, PRDs, and roadmaps that shape implementation.

## Archive

- [Archive](archive/README.md): historical specs, audits, and implementation plans retained for context but not treated as current source of truth.

## Status Convention

Use one of these status labels near the top of durable docs:

- `Current`: reflects the expected system direction now.
- `Draft`: still under discussion.
- `Historical`: useful context, not current truth.
- `Superseded`: replaced by a newer doc.

Git is the version history. Avoid creating `v1`, `v2`, `final`, or duplicate copies unless the document is a formal external artifact.
