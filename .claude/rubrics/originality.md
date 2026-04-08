---
name: originality
version: 1.0.0
weight_default: 0.15
applies_to: [frontend, fullstack]
hard_fail_threshold: FAIL
---

# Originality

## Intent

Measures whether the build feels like a **specific, opinionated product** — not a generic template stretched over a feature list. Anthropic identifies "AI slop" as the dominant failure mode of solo agents: every output looks the same. Originality is the antidote — the rubric explicitly looks for visual, copy, and interaction signatures that would NOT appear in a generic AI generation.

## Criteria

- The product has a name that isn't generic (`KanbanApp`, `MyDashboard`, `TaskTool` all FAIL)
- Hero copy is specific to the product, not interchangeable marketing platitudes
- Empty states have custom illustration / copy, not stock illustration packs
- At least one **interaction or visual signature** is unique to this product (e.g., a custom cursor, a distinctive transition, an unusual layout, a memorable animation, a quirky microcopy voice)
- The product would be **recognizable from a screenshot** without the URL bar visible

## Grading

| Level | Definition |
|---|---|
| PASS | Specific name + specific copy + custom empty states + ≥1 unique interaction/visual signature |
| WARN | Specific name + specific copy BUT no unique signature; feels competent but generic |
| FAIL | Generic name OR interchangeable copy OR stock empty states OR could be any of 100 SaaS products |

## Anti-patterns

- Product name = literal feature description (`KanbanApp`, `NoteApp`, `ChatApp`)
- Hero copy: "The modern way to {feature}" / "Beautifully simple {noun}" / "Built for teams"
- unDraw / Storyset stock illustrations on empty states (the same illustrations every AI-generated app uses)
- Stripe-clone homepage layout (centered hero, 3-column features, testimonials, CTA)
- Lorem ipsum or near-lorem-ipsum filler copy
- "Built with love by the {ProductName} team" footer
- Default favicon / no favicon

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** A retro game generator named "RetroForge" (specific name with personality). Hero copy: "Type a game. Get a game. Marquee tonight at midnight." (specific to the product mechanic, not generic). Empty state on the marquee shows a hand-drawn arcade cabinet with "Be the first" — custom, not stock. Distinctive interaction: a CRT scanline shimmer plays when the cabinet frame loads. Recognizable from a screenshot because of the cabinet motif.
**Verdict:** PASS
**Reasoning:** Specific name, specific copy, custom empty state, unique interaction signature (CRT shimmer), screenshot-recognizable. All 5 criteria met.

### Example 2 — FAIL

**Artifact:** "TaskFlow — The modern way to manage tasks". Centered hero with purple gradient, 3-column feature grid, "Built for teams" subhead, undraw illustration on empty state ("Empty list — add a task to get started"), no favicon. Could be screenshotted next to 50 other AI-generated SaaS apps and indistinguishable.
**Verdict:** FAIL
**Reasoning:** Generic name, interchangeable hero copy ("modern way to"), unDraw stock illustration, no unique signature, NOT recognizable from screenshot. Canonical AI slop.

## References

- Anthropic harness article §4 (originality weighted high to penalize slop)
- "AI slop" failure mode catalog
