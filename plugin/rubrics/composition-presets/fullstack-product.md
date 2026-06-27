---
name: fullstack-product
version: 1.0.0
applies_to: [fullstack]
description: Composition for full-stack product builds. UX weighted higher than frontend-app.
rubrics:
  - name: product-depth
    weight: 0.20
  - name: functionality
    weight: 0.20
  - name: design-quality
    weight: 0.15
  - name: originality
    weight: 0.15
  - name: ux-usability
    weight: 0.15
  - name: code-quality
    weight: 0.10
  - name: craft
    weight: 0.05
---

# Preset: fullstack-product

Composition for end-to-end product builds — frontend + backend + persistence + auth. The most demanding preset.

## When to Use

- Spec produces a complete product (not a prototype, not an API, not a CLI)
- Build has both UI and server-side logic
- Real users would actually use this if shipped
- Verification spans browser AND API surface

## Weight Rationale

- **product-depth + functionality (0.40)** — still the dominant signal but lower than frontend-app (other dimensions matter more in a real product)
- **design-quality + originality (0.30)** — slop penalty held strong
- **ux-usability (0.15)** — **3x higher than frontend-app** (0.05 → 0.15) because real products live or die on whether humans complete the core action
- **code-quality (0.10)** — same floor
- **craft (0.05)** — same tiebreaker

Weights sum to 1.00.

## Why ux-usability Is Weighted Higher Here

A frontend prototype can look great in screenshots and still fail to be usable. A full-stack product is meant to be **shipped to humans**. Time-to-value, recoverable errors, and progressive forms become first-class signals — not polish.

## Hard-Fail Inheritance

Most common FAIL paths in fullstack-product:
- product-depth: spec called for 12 features, build has 6
- functionality: signup → confirm-email flow broken, can't get past page 2
- ux-usability: 4-step required onboarding wall before any value
- originality: looks like every other Stripe-clone SaaS landing page
