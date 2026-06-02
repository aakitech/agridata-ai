# MPBC Pest Workflow Question Audit

This document lists all user-facing questions currently defined for MPBC pest reporting workflows in the codebase.

## Runtime note

MPBC currently uses the config-driven pest workflow whenever there are active pest configs for the organization. That selection happens in [workflow.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/workflow.ts:107).

- If active pest configs exist: `MpbcPestConfigProcessor` runs.
- If no active pest configs exist: the older seeded workflow config runs.

## 1. Current runtime workflow: config-driven MPBC multi-pest flow

Primary prompt sources:

- Pest selection and shared prompts: [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:231)
- Pest-specific field prompts: [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:54)

### 1.1 Shared questions

These are the questions asked before or after the pest-specific questions.

| Order | Question | When asked | Source |
| --- | --- | --- | --- |
| 1 | `Hello {{OfficerName}}`<br><br>`This is the MPBC Pest Monitoring system.`<br>`Please select the pest you are reporting:` | Always | [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:231) |
| 2 | `How are you observing {pest} today?` | Only if a pest has more than one active observation method | [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:245) |
| 3 | `Optional: please upload a photo of the observation, or reply SKIP to continue.` | After pest-specific fields | [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:319) |
| 4 | `📍 Please share your GPS location for this trap.` plus the WhatsApp location instructions | After photo, only for `PHEROMONE_TRAP` methods | [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:329) |
| 5 | `📍 Please share your GPS location for this observation.` plus the WhatsApp location instructions | After photo, for non-trap methods | [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:329) |

### 1.2 Pest-specific questions currently seeded for MPBC

#### African Armyworm

Workflow shape:

1. Pest selection
2. `How many moths were caught in the trap? Enter 0 if none were observed.`
3. Optional photo
4. Trap GPS location

Question source: [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:56)

#### Locusts

Workflow shape:

1. Pest selection
2. `How large was the locust event?`
3. `Which direction were the locusts moving?`
4. `What were the locusts doing?`
5. `What type of crop / vegetation is affected?`
6. `Please describe the other crop / vegetation type affected.` only when `crop_vegetation_type = Other`
7. Optional photo
8. Observation GPS location

Question source: [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:101)

#### Quelea Birds

Workflow shape:

1. Pest selection
2. `What was the estimated flock size?`
3. `What were the birds doing?`
4. `What type of crop / vegetation is affected?`
5. `Please describe the other crop / vegetation type affected.` only when `crop_vegetation_type = Other`
6. `What is the crop growth stage?`
7. Optional photo
8. Observation GPS location

Question source: [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:185)

#### Rodents

Workflow shape:

1. Pest selection
2. `What level of rodent activity was observed?`
3. `Compared to recent observations, is rodent activity increasing, stable, or decreasing?`
4. `What type of rodent damage or sign was observed?`
5. `Please describe the other rodent damage or sign observed.` only when `damage_type = Other`
6. Optional photo
7. Observation GPS location

Question source: [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:260)

#### Fall Armyworm

Workflow shape:

1. Pest selection
2. `How many adult insects were caught in the trap? Enter 0 if none were observed.`
3. Optional photo
4. Trap GPS location

Question source: [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:354)

### 1.3 Current seeded question inventory

This is the full set of distinct question texts currently active in the config-driven MPBC flow.

| Category | Question |
| --- | --- |
| Shared | `Hello {{OfficerName}}` / `This is the MPBC Pest Monitoring system.` / `Please select the pest you are reporting:` |
| Conditional shared | `How are you observing {pest} today?` |
| African Armyworm | `How many moths were caught in the trap? Enter 0 if none were observed.` |
| Locusts | `How large was the locust event?` |
| Locusts | `Which direction were the locusts moving?` |
| Locusts | `What were the locusts doing?` |
| Locusts | `What type of crop / vegetation is affected?` |
| Locusts conditional | `Please describe the other crop / vegetation type affected.` |
| Quelea Birds | `What was the estimated flock size?` |
| Quelea Birds | `What were the birds doing?` |
| Quelea Birds | `What type of crop / vegetation is affected?` |
| Quelea Birds conditional | `Please describe the other crop / vegetation type affected.` |
| Quelea Birds | `What is the crop growth stage?` |
| Rodents | `What level of rodent activity was observed?` |
| Rodents | `Compared to recent observations, is rodent activity increasing, stable, or decreasing?` |
| Rodents | `What type of rodent damage or sign was observed?` |
| Rodents conditional | `Please describe the other rodent damage or sign observed.` |
| Fall Armyworm | `How many adult insects were caught in the trap? Enter 0 if none were observed.` |
| Shared | `Optional: please upload a photo of the observation, or reply SKIP to continue.` |
| Shared trap variant | `📍 Please share your GPS location for this trap.` |
| Shared observation variant | `📍 Please share your GPS location for this observation.` |

## 2. Legacy fallback workflow: `mpbc_trap`

This older workflow still exists in the seeded workflow config and is used only when MPBC does not have active pest configs.

Primary source: [whatsapp-bot-seed-workflows.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/whatsapp-bot-seed-workflows.ts:27)

### 2.1 Legacy question flow

1. `👋 Hello {{OfficerName}}`
   `This is the MPBC Trap Monitoring system.`
   `We'll record your latest African Armyworm trap observation.`
   `Let's begin.`
   `🐛 Which pest are you observing?`
2. `🔢 How many pests were caught in the trap?`
   `Please enter a number only.`
   `Example: 3`
3. `📸 Optional:`
   `You may upload a photo of what was caught in the trap.`
   `Or reply SKIP to continue.`
4. `📍 Please share your GPS location for this trap.`
   plus WhatsApp location instructions

## 3. Key audit observations

- The current MPBC flow is not a single questionnaire. It branches by pest after the first selection.
- There is support for a second branching question, `How are you observing {pest} today?`, but none of the currently seeded MPBC pests has more than one active method, so that question is not currently shown.
- Rodents and Locusts include conditional follow-up text questions when the officer selects `Other`.
- Quelea Birds now use a fixed behavior list without an `Other` option, which keeps the activity field structured and avoids low-value summaries such as `Activity: Other`.
- The legacy flow is still present and uses different wording from the newer config-driven flow.
- The older code and README are inconsistent on pest naming in places:
  `README.md` describes Fall Armyworm, while the seeded legacy workflow currently says African Armyworm.

## 4. Best next design targets

If you are planning updates, the main prompt surfaces to revise are:

1. Pest selection wording in [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:231)
2. Shared photo and location wording in [mpbc-pest-config-processor.ts](/Users/mohara/Documents/aakitech/Saas/agridata/src/server/modules/whatsapp-bot/mpbc-pest-config-processor.ts:319)
3. Pest-specific question wording in [seed-mpbc-pest-configs.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/seed-mpbc-pest-configs.ts:54)
4. Legacy fallback wording in [whatsapp-bot-seed-workflows.ts](/Users/mohara/Documents/aakitech/Saas/agridata/scripts/whatsapp-bot-seed-workflows.ts:27)
