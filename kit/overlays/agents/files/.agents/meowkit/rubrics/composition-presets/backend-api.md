---
name: backend-api
version: 1.0.0
applies_to: [backend]
description: Composition for headless API / service builds. No visual rubrics.
rubrics:
  - name: product-depth
    weight: 0.30
  - name: functionality
    weight: 0.45
  - name: code-quality
    weight: 0.25
---

# Preset: backend-api

Composition for headless backends — REST APIs, GraphQL servers, gRPC services, background workers.

## When to Use

- Spec produces a non-UI service (API, CLI daemon, worker)
- No visual surface to evaluate
- Verification is via curl / API client / test harness

## Weight Rationale

- **functionality (0.45)** — for an API, "does it work" is the dominant signal
- **product-depth (0.30)** — endpoint coverage vs. spec
- **code-quality (0.25)** — maintainability matters more without a visual surface to distract reviewers

Visual rubrics (design-quality, originality, craft, ux-usability) are excluded — there's no UI to grade.

Weights sum to 1.00.

## Hard-Fail Inheritance

Any FAIL on the 3 included rubrics fails the sprint. functionality FAIL is most common (curl returns 500, missing endpoint, broken auth).
