---
name: frontend-app
version: 2.0.0
applies_to: [frontend]
description: Default composition for browser-rendered apps. 4 distinctive rubrics — pruned per red-team necessity audit (260408).
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

Default composition for any frontend / browser-rendered build. **Pruned in v2.0.0** to the 4 rubrics that close evaluation gaps the rest of the meowkit ecosystem doesn't already cover.

## When to Use

- Spec produces a browser app (SPA, MPA, Next.js, Vue, Svelte, etc.)
- Build has a visual surface and user interactions
- The deliverable can be exercised by `mk:agent-browser` or `mk:playwright-cli`

## What Changed in v2.0.0

The red-team necessity audit (`plans/reports/red-team-260408-1117-rubric-necessity-audit.md`) found that `code-quality`, `craft`, and `ux-usability` rubrics overlap with existing `mk:review` 5-dim verdict, security-rules, and tdd-rules. Loading them by default duplicated work the existing layers already do.

The 4 retained rubrics each close a verified gap:

| Rubric | Gap closed (audit-verified) |
|---|---|
| `product-depth` | Solo agent under-scoping. `mk:review` Criteria Auditor accepts stubs and silent feature substitutions. |
| `functionality` | Active verification. `mk:verify` runs build/lint/test/coverage but never executes the artifact (no curl, no browser). |
| `design-quality` | AI slop. `mk:review/references/design-review.md` was silently disabled by a deleted-file dependency until the 260408 fix. |
| `originality` | AI slop, generic copy, stock illustrations. No existing layer evaluates visual originality at all. |

## Excluded Rubrics (still in library, opt-in only)

| Rubric | Why excluded from default | When to opt in |
|---|---|---|
| `code-quality` | Overlaps `mk:review` Maintainability dim + `security-rules.md` hardcoded-secret hard fail | Add explicitly when reviewing legacy code without an active review pipeline |
| `craft` | Overlaps `mk:review` Polish dim + `naming-rules.md` | Add for ship-quality polish gates, not prototypes |
| `ux-usability` | Overlaps `mk:qa` health-score and existing review UX coverage | Already wired into `fullstack-product` preset; add manually for UX-primary risk |

To opt in to one of these for a specific run, the evaluator can call `load-rubric.sh <name>` directly without changing the preset.

## Weight Rationale

- **product-depth + functionality (0.60)** — under-scoping and active-verification are the audit's top scenarios. 60% of the weight is "the spec was honored AND it actually runs."
- **design-quality + originality (0.40)** — slop is the dominant solo-agent failure mode per Anthropic. Combined weight matches Anthropic's published bias against generic output.

Weights sum to 1.00.

## Hard-Fail Inheritance

All 4 rubrics have `hard_fail_threshold: FAIL`. Any single FAIL fails the sprint regardless of the others. No WARN-tier rubrics in this preset — every dimension is load-bearing.
