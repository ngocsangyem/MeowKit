---
title: "mk:plan-ceo-review"
description: "CEO/founder-mode plan review — layered verification pipeline with pre-screening, two-lens evaluation, severity tiers, and adversarial necessity."
---
# mk:plan-ceo-review

CEO/founder-mode plan review — a decision and validation layer (NOT a planner). Challenges whether the plan solves the right problem and can be built as scoped.

## What This Skill Does

Reviews plans through a **layered verification pipeline** that fast-fails on cheap checks before spending on expensive judgment:

```
Layer 0-1: Pre-Screen (placeholders, structure, coverage)
Layer 3:   Two-Lens Eval (Intent Alignment + Execution Credibility)
Layer 4:   Deep Review (11 sections with severity tiers + adversarial necessity)
Layer 5:   Verdict + Handoff (append-only output to plan.md)
```

## Core Capabilities

- **Four modes** — Expand, Selective Expand, Hold, Reduce (unchanged)
- **Pre-screen gate** — catches unfinished plans before human review (mode-aware, never rejects — returns for amendment)
- **Two-lens evaluation** — Intent Alignment (right problem?) + Execution Credibility (buildable?). Any FAIL → NEEDS REVISION
- **Severity tiers** — all findings classified: BLOCKER / HIGH-LEVERAGE / POLISH
- **Adversarial necessity** — must surface ≥1 finding per section or document evidence why clean
- **Append-only output** — `## CEO Review` block appended to plan.md (never overwrites)
- **Coverage mapping** — requirements → tasks traceability table
- **Merged failure analysis** — Error & Rescue + Failure Modes in one table

## Usage

```bash
/mk:plan-ceo-review                    # default mode
/mk:plan-ceo-review --scope-expand     # dream big
/mk:plan-ceo-review --hold-scope       # maximum rigor
/mk:plan-ceo-review --reduce-scope     # strip to essentials
```

::: info Skill Details
**Phase:** 1 (post-plan, pre-implementation)
**Used by:** planner agent
**Suggested by:** plan-creator (step-08) for hard/deep/parallel modes, harness (step-01) for product builds
:::

## Verdict Format

Appended to plan.md after review:

```markdown
## CEO Review (2026-04-11, HOLD SCOPE)
**Verdict:** APPROVED with 2 high-leverage items
**Two-Lens:** Intent PASS, Execution WARN
**Blockers:** 0
**High-leverage:** 2
**Polish:** 3
**Coverage:** 8/8 requirements mapped
```

## Gotchas

- **Scope expansion beyond available resources**: "10-star thinking" produces a plan that would take 6 months → Always anchor expansion ideas to current sprint capacity
- **Missing deadlines chasing ambition**: Perfecting the plan instead of shipping MVP → Set a time-box for review; output "ship as-is" or "one targeted improvement"
- **Pre-screen false positives**: `TODO` in plan body text triggers placeholder scan — section headers (`## TODO List`) are excluded

## Output — Print & Stop

This skill ends with a **Print & Stop**:
- Appends `## CEO Review` block to plan.md
- Prints a handoff block with the `/mk:cook [plan path]` command
- Stops — Claude will not proceed automatically

## Related
- [`mk:plan-creator`](/reference/skills/plan-creator) — Creates the plan that CEO review examines
- [`mk:validate-plan`](/reference/skills/validate-plan) — 8-dimension binary validation (complementary, not overlapping)
- [`mk:office-hours`](/reference/skills/office-hours) — Use before plan reviews for ideation
