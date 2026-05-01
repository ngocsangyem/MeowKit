---
title: Harness Architecture
description: The /mk:harness autonomous build pipeline — generator/evaluator split, sprint contract, iteration loop, adaptive density.
---

> **See also:** [Autonomous Build](/guides/autonomous-build) — the how-to walkthrough.

# Harness Architecture

`/mk:harness` is the autonomous build pipeline for green-field products. This page covers the architecture — the four roles, the pipeline flow, and the design decisions. For a step-by-step walkthrough, see the [how-to guide](/guides/autonomous-build).

## Why this exists

**Self-evaluation bias.** When the same model writes and grades code, it finds real issues then reasons itself into accepting them. The harness splits work across separate agents so no agent grades its own output.

**The dead-weight thesis.** Intermediate models under-scope without explicit scaffolding. The harness forces product-level specification before any code is written.

## The four roles

| Role | Agent | What it does |
|------|-------|-------------|
| Planner | `mk:plan-creator --product-level` | Produces user stories and features, not file names. Sets ambition; generator finds the path. |
| Generator | developer agent | Implements from the sprint contract. Produces source + self-eval checklist. Must NOT grade its own output. |
| Evaluator | evaluator agent | Fresh context, skeptic persona. Drives the running build (browser, curl, CLI). Static-only verdicts are rejected. |
| Orchestrator | harness script | Manages iteration loop, budget, escalation, density selection. |

## Pipeline flow

```
User prompt
  → Planner: product-level spec
  → Sprint contract (FULL density) or skip (LEAN)
  → Generator: build + self-eval
  → Evaluator: active verification against rubrics
  → PASS/WARN → Ship
  → FAIL → loop back to Generator (up to 3 rounds)
  → FAIL after 3 rounds → escalate to human
```

## Sprint contract

A signed agreement on what "done" means — testable acceptance criteria negotiated before the generator writes code.

- **FULL density (Sonnet, Opus 4.5):** required. Without it, capable models silently substitute features.
- **LEAN density (Opus 4.6+):** optional. Skip if fewer than 5 acceptance criteria needed.
- **MINIMAL density (Haiku):** skipped entirely. Short-circuits to `/mk:cook`.

## Iteration loop

Capped at 3 rounds by default (`--max-iter N` to override). After round 3, the human makes the call: ship as-is, retry with guidance, or abandon. Budget guardrails ($30 warn / $100 block) fire independently of round count.

## Active verification — hard gate

The evaluator MUST drive the running build. Browser navigation, curl against endpoints, CLI invocation. PASS verdicts with empty `evidence/` directory are auto-converted to FAIL. This is the only mitigation marked NEVER PRUNE in the dead-weight audit registry.

## Self-eval bias — hard separation

Generator and evaluator are distinct subagents with isolated contexts. No shared memory. No access to each other's reasoning. The evaluator loads a skeptic persona and re-anchors per criterion.

## Next steps

- [Autonomous build walkthrough](/guides/autonomous-build)
- [Adaptive density](/guide/adaptive-density) — the dead-weight thesis in detail
- [Rubric library](/guide/rubric-library) — how builds are graded
- [Harness rules](/reference/rules-index#harness-rules) — all 11 rules
