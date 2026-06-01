# Investigation Epic: Image Annotation and Training Dataset

## Purpose

Design how AgriData and Kutsaga will turn submitted pest and disease images into a structured, expert-labelled dataset for future AI model training.

## Background

Felix said Kutsaga can provide image repositories and sample images. The product should also collect new farmer-submitted images in a way that supports future machine learning.

## Problem Statement

Images alone are not enough for model training. They need metadata, quality review, expert labels, confidence, and training eligibility. Without this structure, today's image collection may not be reusable later.

## Goals

- Store every image with report context.
- Let experts rate image quality.
- Let experts label pest/disease/unclear.
- Mark images as training eligible or not.
- Preserve context such as crop, symptoms, GPS, and date.
- Prepare for future dataset export.

## Non-Goals

- Do not train an AI model in this phase.
- Do not automate image diagnosis in v1.
- Do not assume all farmer photos are suitable.
- Do not mix unverified labels into training data.

## Annotation Fields

Suggested fields:

- Image ID.
- Report ID.
- Crop.
- Suspected pest/disease.
- Expert label.
- Label category: pest, disease, healthy, unclear, other.
- Expert confidence: low, medium, high.
- Image quality: good, usable, poor.
- Plant part visible: leaf, stem, root, whole plant, trap, field, other.
- Training eligible: yes/no.
- Reason not eligible.
- Expert notes.
- Reviewed by.
- Reviewed date.

## Technical Areas To Inspect

- `src/server/modules/media/media-service.ts`
- `src/server/modules/reports/report-service.ts`
- `src/server/modules/reports/report-types.ts`
- `src/server/db/schema.ts`
- `src/app/dashboard/triage/_components/report-detail.tsx`

## Product Decisions Needed

- Who can annotate images?
- Should annotation happen inside report detail or a dedicated annotation queue?
- Should imported Kutsaga repository images use the same model as farmer-submitted images?
- What labels should be allowed in v1?
- Should one image support multiple labels?
- How should consent/privacy be handled for model training?
- What export format will future ML work need?

## Suggested Phasing

### Phase 1

- Ensure report images are linked to structured report metadata.
- Add manual image quality and training eligibility fields.
- Add simple expert label fields.

### Phase 2

- Add annotation queue and filters.
- Add bulk review for Kutsaga-provided image repositories.
- Add dataset export.

### Phase 3

- Add model training pipeline integration.
- Add AI-assisted pre-label suggestions with expert verification.

## Investigation Acceptance Criteria

- Current media storage and report linking are reviewed.
- Annotation data model is proposed.
- V1 annotation UI location is recommended.
- Training dataset eligibility rules are drafted.
- Implementation tickets are split from this epic.

