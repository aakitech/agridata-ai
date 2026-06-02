# Architecture Decision Records

**Status:** Current

ADRs capture durable decisions and the reasoning behind them.

Use ADRs for choices that will be expensive to reverse or that future contributors are likely to question, such as:

- messaging provider choices
- database and ORM choices
- observability tooling
- feature flag strategy
- Product Lab guardrails
- tenant isolation approach

Existing decision-style docs:

- [Weather enrichment v1](weather-enrichment-v1.md)
- [Weather enrichment scheduling](weather-enrichment-scheduling.md)

Future ADRs should use a short numbered filename:

```text
0001-use-twilio-for-whatsapp.md
0002-use-drizzle-postgres.md
```

Suggested sections:

- Context
- Decision
- Consequences
- Alternatives considered

