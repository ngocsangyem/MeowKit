---
name: frontend-app
version: 2.0.0
applies_to: [frontend]
description: Default composition for browser-rendered apps. 4 distinctive rubrics; the other three overlap existing review layers.
rubrics:
  - name: product-depth
    weight: 0.30
  - name: functionality
    weight: 0.30
  - name: design-quality
    weight: 0.20
  - name: originality
    weight: 0.20
---

# Preset: frontend-app

Default composition for any frontend / browser-rendered build. **Pruned in v2.0.0** to the 4 rubrics that close evaluation gaps the rest of the kit doesn't already cover.

## When to Use

- Spec produces a browser app (SPA, MPA, Next.js, Vue, Svelte, etc.)
- Build has a visual surface and user interactions
- The deliverable can be exercised by `mk:agent-browser` or `mk:playwright-cli`

## What the preset loads and why

`code-quality`, `craft` and `ux-usability` overlap `mk:review`, the security rules and `mk:qa`, so they are not loaded by default. The four retained rubrics each cover a gap those layers leave:

| Rubric | Gap it covers |
|---|---|
| `product-depth` | A solo agent under-scoping; `mk:review`'s Criteria Auditor accepts stubs and silent feature substitution |
| `functionality` | Active verification; `mk:verify` runs build, lint and tests but never exercises the artifact |
| `design-quality` | Generic, templated visual output |
| `originality` | Stock illustrations and generic copy; no other layer judges originality |

## Excluded Rubrics (still in library, opt-in only)

| Rubric | Why excluded from default | When to opt in |
|---|---|---|
| `code-quality` | Overlaps `mk:review` Maintainability dim + `security-rules.md` hardcoded-secret hard fail | Add explicitly when reviewing legacy code without an active review pipeline |
| `craft` | Overlaps `mk:review` Polish dim + `agent-conduct.md` (B1) | Add for ship-quality polish gates, not prototypes |
| `ux-usability` | Overlaps `mk:qa` health-score and existing review UX coverage | Already wired into `fullstack-product` preset; add manually for UX-primary risk |

To opt in to one of these for a specific run, the evaluator can call `load-rubric.sh <name>` directly without changing the preset.

## Weight Rationale

- **product-depth + functionality (0.60)** — under-scoping and missing active verification are the top failure modes. 60% of the weight is "the spec was honored AND it actually runs."
- **design-quality + originality (0.40)** — slop is the dominant solo-agent failure mode. Combined weight matches Anthropic's published bias against generic output.

Weights sum to 1.00.

## Hard-Fail Inheritance

All 4 rubrics have `hard_fail_threshold: FAIL`. Any single FAIL fails the sprint regardless of the others. No WARN-tier rubrics in this preset — every dimension is load-bearing.
