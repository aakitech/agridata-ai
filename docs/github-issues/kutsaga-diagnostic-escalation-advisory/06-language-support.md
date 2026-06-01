# Investigation Epic: English and Shona Language Support

## Purpose

Design multilingual support for Kutsaga WhatsApp flows, starting with English and Shona.

## Background

Felix noted a suggestion to introduce multilingual support so farmers can choose English or Shona. This can improve adoption and clarity, but agronomic and pesticide content must be translated carefully.

## Problem Statement

The current flows are English-first. Adding Shona requires more than translating strings because diagnostic terms, disease symptoms, and advisory content must remain accurate and approved.

## Goals

- Let farmers choose language.
- Translate stable flow questions.
- Support advisory content translations.
- Avoid unsafe automatic translation for product/control advice.
- Store language preference with reports.

## Non-Goals

- Do not auto-translate pesticide recommendations without review.
- Do not support all Zimbabwean languages in v1.
- Do not redesign the whole workflow engine solely for translation before scope is understood.

## Candidate User Flow

At first interaction or report start:

```text
Choose language / Sarudza mutauro
1. English
2. Shona
```

Then the selected language should apply to:

- Menu options.
- Questions.
- Validation messages.
- Final response.
- Advisory content where approved translation exists.

## Technical Areas To Inspect

- `src/server/modules/whatsapp-bot/workflow-types.ts`
- `src/server/modules/whatsapp-bot/workflow.ts`
- `src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts`
- `src/server/db/schema.ts`
- Kutsaga seed/config scripts.

## Product Decisions Needed

- Is language preference per user, per session, or per report?
- Should language selection happen once or at every report?
- Who approves Shona translations?
- What happens if advisory content is available in English but not Shona?
- Should officers see original farmer language and translated labels?
- Should report data store canonical English values plus localized labels?

## Suggested Phasing

### Phase 1

- Add language selection for Kutsaga flow.
- Store selected language.
- Translate stable menus and generic messages.

### Phase 2

- Translate pest/disease diagnostic questions after flow approval.
- Add localized validation and help messages.

### Phase 3

- Add approved Shona advisory content.
- Add content review workflow for translations.

## Investigation Acceptance Criteria

- Current workflow copy/config structure is reviewed.
- Language preference storage approach is recommended.
- Translation content model is drafted.
- V1 copy scope is defined.
- Implementation tickets are split from this epic.

