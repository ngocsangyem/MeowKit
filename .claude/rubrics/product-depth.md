---
name: product-depth
version: 1.0.0
weight_default: 0.25
applies_to: [frontend, backend, fullstack, cli]
hard_fail_threshold: FAIL
---

# Product Depth

## Intent

Measures whether the build delivers on the **ambition of the product spec**, not just a technical demo. A solo agent's default failure mode is under-scoping — shipping 3 features when the spec called for 12. Product depth keeps the generator honest about scope and prevents "MVP rationalization" where the agent silently strips features it found inconvenient.

## Criteria

- ≥80% of spec features are implemented and reachable from the UI/CLI
- Each implemented feature works end-to-end on real input (not just a stub)
- Features are not visibly degraded vs. their spec acceptance criteria
- No silent feature substitution ("I built a list view instead of the kanban board")
- The build matches the **ambition level** of the spec, not the easiest interpretation

## Grading

| Level | Definition |
|---|---|
| PASS | ≥80% of spec features implemented + working end-to-end + match spec ACs |
| WARN | 60-79% of features implemented OR 1-2 features visibly degraded |
| FAIL | <60% of features implemented OR core feature stubbed/missing/silently substituted |

## Anti-patterns

- "I implemented the most important features and noted the rest as TODO"
- Stub implementations passing as real features (button exists but does nothing)
- Silent feature substitution (kanban → flat list, real-time → polling, AI generation → static text)
- Renaming features to match what was easier to build
- Disabling features behind a feature flag without disclosure

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** Spec called for 12 features. Build implements 11 (skipped 1 explicitly with rationale in handoff notes). All 11 work end-to-end on real input. Acceptance criteria for each implemented feature pass when manually exercised.
**Verdict:** PASS
**Reasoning:** 92% feature coverage, no silent substitutions, the one skipped feature is documented with rationale. Meets spec ambition.

### Example 2 — FAIL

**Artifact:** Spec called for 15 features (kanban app with collaboration, real-time, AI suggestions). Build implements: list view, basic CRUD, signup. 5/15 features. AI suggestions are a static "Pro Tip" panel with hardcoded text. Real-time replaced by 5-second polling without disclosure.
**Verdict:** FAIL
**Reasoning:** 33% feature coverage (below 60% FAIL threshold) AND silent substitution (AI suggestions stubbed, real-time degraded to polling). Generator under-scoped and rationalized.

## References

- Anthropic harness article §3 (under-scoping is the default failure mode)
- research/researcher-01-harness-patterns.md §2
