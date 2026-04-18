# Product Requirements Document - WhatsApp Session Commands

**Version:** v0.1  
**Last Updated:** April 18, 2026  
**Status:** 🚧 Planned

---

## Overview

This document defines the first version and future evolution of **session-level chat commands** for the AgriData WhatsApp reporting workflow.

The immediate goal is to let a user safely stop an in-progress reporting flow by typing `cancel`.

The broader goal is to introduce a small, predictable command model for conversational workflows so users can:

- stop a flow
- restart a flow
- ask what commands are available
- recover when they feel stuck

This PRD is intended to be readable by both product and engineering stakeholders. It records:

- what behavior exists today
- what minimal version we plan to ship first
- what we expect to add in version 2
- how to think about UI/UX tradeoffs for chat-based workflows

---

## Problem Statement

The current WhatsApp workflow is strict and linear. Users are expected to answer the current step correctly or type `RESET` to clear the session.

That creates a few usability problems:

- `RESET` is technical language and may not be the first word a user tries
- users who want to abandon a report may naturally type `cancel`, `stop`, or `quit`
- there is no lightweight, user-friendly explanation of what commands are available
- the current command behavior is not framed as part of the user experience

In a messaging interface, users need a clear escape hatch. If they cannot easily leave or restart a flow, the experience feels brittle and frustrating.

---

## Goals

### Primary Goal

Allow a user to stop an in-progress report by typing `cancel`.

### Secondary Goals

- make the workflow feel safer and easier to recover from
- reduce confusion when a user no longer wants to continue
- establish a clean foundation for additional commands such as `help` and `restart`
- document intended behavior clearly enough that future contributors understand both the shipped version and the roadmap

---

## Non-Goals

The first version does not attempt to:

- create resumable drafts
- preserve partially completed reports after cancellation
- support a large natural-language intent layer
- add command-specific UI in the dashboard
- replace the full workflow engine

Version 1 is intentionally small and operationally safe.

---

## Current State

At the time of writing, the system already supports a global `RESET` command in [workflow.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/workflow.ts:77).

Current behavior:

- the incoming message body is normalized to uppercase
- if the body is `RESET`, the current session is cleared
- session fields such as `currentStep`, `dataCollected`, and `workflowId` are reset
- the session `status` is set to `RESET`
- the user receives: `Conversation reset. What can I help you with today?`

This behavior is handled before workflow-specific processing, which is good because it makes the command global rather than step-dependent.

Relevant code surfaces:

- command interception: [workflow.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/workflow.ts:77)
- generic workflow processor: [workflow-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/workflow-processor.ts:41)
- MPBC config-driven processor: [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:49)
- session schema: [schema.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/db/schema.ts:348)

---

## User Insight

In chat products, users do not think in terms of database state or session resets. They think in terms of intent:

- "I want to stop"
- "I made a mistake"
- "I want to start over"
- "What can I type here?"

`cancel` matches natural user language better than `reset`.

That means the feature is not just a technical alias. It is a UX improvement that reduces anxiety and makes the workflow feel more forgiving.

---

## Proposed Solution

Introduce a phased **session command model**.

### Version 1

Ship the smallest useful change:

- support `cancel` as a global command
- end the active in-progress session
- clear partial progress
- confirm that nothing was submitted
- lightly advertise the command in the workflow copy

### Version 2

Extend the command model with:

- `help`
- `restart`
- a small set of supported synonyms such as `stop`, `quit`, and `exit`

This creates a more discoverable, user-friendly conversational system without requiring a full natural-language parser.

---

## Product Principles

The command system should follow these principles:

### 1. Global

Commands should be recognized before workflow-step validation. A user typing `cancel` should get the same outcome no matter which step they are on.

### 2. Predictable

Each command should have one clear meaning.

Recommended meanings:

- `cancel`: abandon the current in-progress report
- `restart`: start the current reporting flow from the beginning
- `help`: show available commands and what they do

### 3. Low-Risk

When a user exits a flow, the bot should clearly say whether anything was saved.

### 4. Minimal

We should avoid adding too many commands at once. Messaging UX becomes harder to learn when there are too many system words.

---

## Version 1 Requirements

### Summary

Version 1 introduces a single user-friendly command: `cancel`.

### Functional Requirements

1. The system must recognize `cancel` regardless of letter case.
2. `cancel` must be handled before any workflow-specific validation.
3. If a session is active, `cancel` must clear the in-progress session state.
4. If no session is meaningfully in progress, the bot should still respond gracefully.
5. The response must make it clear that no report was submitted.
6. The workflow should lightly communicate that `cancel` is available.

### Recommended Behavior

If an active report exists:

- clear current step
- clear collected data
- clear workflow association if needed
- set a reset/cancelled-style status
- reply with a clear confirmation

If no active report exists:

- do not throw an error
- reply with a simple message such as: `There is no active report to cancel.`

### Recommended User Copy

At the start of the workflow:

`Reply cancel anytime to stop this report.`

After successful cancel:

`Current report cancelled. Nothing was submitted. Send any message when you're ready to begin again.`

If no active report exists:

`There is no active report to cancel.`

### UX Notes

For V1, `cancel` should behave immediately. It does not need a confirmation step such as "Are you sure?" because:

- typing `cancel` is a deliberate act
- the workflow is relatively short
- adding a confirmation loop increases friction

If future reporting flows become much longer, confirmation can be revisited.

---

## Version 2 Requirements

### Summary

Version 2 expands the command model into a small set of explicit workflow commands and selected synonyms.

### Commands

#### `help`

Purpose:

- explain available workflow commands
- help a stuck user recover without external support

Recommended response:

`You can reply with:`
`- cancel: stop the current report`
`- restart: start this report again from the beginning`
`- help: show these options`

#### `restart`

Purpose:

- restart the current reporting flow from step 1
- preserve the idea that the user still wants to submit a report, just not continue from the current point

Recommended behavior:

- clear step progress and collected data
- keep the user inside the reporting experience
- immediately send the first question again

Recommended response:

`Report restarted. Let's begin again.`

#### Synonyms

Candidate synonyms:

- for cancel: `stop`, `quit`, `exit`
- optionally for help: `commands`
- optionally for restart: `start over`

Version 2 should support only a small, deliberate list of synonyms. This should not become open-ended fuzzy intent matching.

### Additional Version 2 UX Copy

Start message example:

`Reply help for commands, or cancel anytime to stop this report.`

Error-state message example:

`I didn't understand that answer. Reply help for commands, or try again.`

---

## Command Semantics

This section defines the intended meanings clearly so future contributors do not blur them.

| Command | Meaning | Saves partial progress? | Continues current flow? |
| --- | --- | --- | --- |
| `cancel` | Stop the current report and abandon it | No | No |
| `restart` | Start the current report again from the beginning | No | Yes |
| `help` | Show available commands | N/A | Yes |

This distinction matters. `cancel` and `restart` should not collapse into the same action from a UX perspective, even if they initially share some implementation details.

---

## Edge Cases

The command design should explicitly handle the following:

### 1. User types `cancel` during numeric selection

Expected behavior:

- command wins
- it should not be interpreted as invalid numeric input

### 2. User types `cancel` after uploading a photo

Expected behavior:

- command wins
- partial session is discarded
- no final report is created

### 3. User types `cancel` when no session exists

Expected behavior:

- graceful reply
- no error

### 4. User types `cancel` after report completion

Expected behavior:

- no previously submitted report is deleted
- bot explains there is no active in-progress report to cancel

### 5. User types an unsupported synonym in Version 1

Expected behavior:

- the system treats it as normal input
- the doc should make clear that only `cancel` is guaranteed in V1

---

## UX Considerations

### Why `cancel` is a good first step

`cancel` solves the most important recovery need with minimal complexity.

It gives users:

- a sense of control
- a clear way out
- reduced fear of getting trapped in the workflow

### Why not add everything at once

Shipping `help`, `restart`, and multiple synonyms immediately adds more surface area:

- more copy to maintain
- more edge cases to test
- more opportunities for ambiguous behavior

A smaller V1 lets us validate actual usage before expanding.

### Discoverability

Chat UIs do not have visible buttons all the time, so command discoverability has to come from copy.

The best pattern is subtle and repeated only where useful:

- mention `cancel` in the opening message
- mention `help` later when V2 ships
- avoid adding command reminders to every single prompt

---

## Engineering Approach

### Recommended Implementation Strategy

Keep command handling centralized in [workflow.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/workflow.ts:77), before the system selects and executes either workflow processor.

This approach is preferred because:

- commands remain consistent across all workflows
- processors stay focused on step logic
- command additions in V2 remain easy to extend

### Suggested Technical Shape

Version 1:

- add a normalized check for `cancel`
- use the same core reset logic currently used by `RESET`
- update response copy to be more user-centered
- optionally refine `RESET` to align with the new wording

Version 2:

- extract command handling into a small helper such as `handleSessionCommand()`
- define supported commands in one place
- keep workflow processors unaware of command parsing

### Data Model Notes

The current session schema already supports this work through [botSessions](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/db/schema.ts:348).

Potential future refinement:

- introduce a dedicated `CANCELLED` session status if product analytics later need to distinguish `cancel` from `reset`

This is not required for V1.

---

## Analytics and Observability

Not required for the first implementation, but recommended later:

- count how often `cancel` is used
- identify which step users were on when they cancelled
- track frequency of `help` usage after V2
- compare completion rates before and after command rollout

This would help answer:

- are users getting stuck at specific steps?
- is `cancel` mostly a safety tool or a sign of poor workflow design?

---

## Acceptance Criteria

### Version 1

- a user can type `cancel` at any point in an active workflow
- the system exits the flow consistently
- no partial report is submitted
- the user receives clear confirmation
- opening workflow copy mentions that `cancel` is available
- behavior is documented in this PRD

### Version 2

- a user can type `help` to see available commands
- a user can type `restart` to begin the current report again
- selected synonyms are supported consistently
- command meanings remain distinct and documented

---

## Open Questions

These do not block V1, but should be revisited later:

1. Should `RESET` remain as a visible command, or become an internal/legacy alias?
2. Should `start` eventually become a first-class command as well?
3. Do we want a dedicated `CANCELLED` status for reporting and analytics?
4. If longer workflows are introduced later, should `cancel` require confirmation?
5. Should help text be tailored by workflow type, or remain global?

---

## Recommended Delivery Plan

### Phase 1

Ship the smallest version:

- support `cancel`
- update start-of-flow copy
- improve reset/cancel confirmation wording

### Phase 2

Expand the command system:

- add `help`
- add `restart`
- add a short list of synonyms
- refactor command handling into a shared helper if needed

---

## Summary

This feature is small in implementation size but meaningful in UX impact.

Version 1 gives users a natural way to exit a reporting session without confusion.

Version 2 turns that improvement into a clearer conversational command system that helps users recover, restart, and understand what the bot can do.

By documenting both phases together, we can ship a minimal first step now while preserving a shared understanding of where the experience is heading.
