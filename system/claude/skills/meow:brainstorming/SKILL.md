---
name: meow:brainstorming
preamble-tier: 3
version: 1.0.0
description: |
  Use when exploring technical solutions, comparing approaches, or generating
  alternatives for a validated problem. Triggers on "brainstorm solutions",
  "explore approaches", "compare options", "trade-off analysis", "how should
  we build". Do NOT use for product validation ("is this worth building?" →
  use meow:office-hours instead). Do NOT use when a plan already exists
  (→ use meow:plan-eng-review instead).
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
sources:
  - claudekit-engineer/brainstorm
  - superpowers/brainstorming
---

# Brainstorming

Explore technical solutions with structured ideation, scoring, and plan-creator handoff.

**Differentiator:** office-hours = "should we build this?", brainstorming = "how should we build this?"

## Plan-First Gate

Brainstorming precedes planning — it produces input FOR plans.
Always skips Gate 1 (same as meow:investigate and meow:office-hours).

## Arguments

- `--depth quick` — 5-8 ideas, no scoring (default)
- `--depth deep` — scored ideas + top 3 + optional action-plan handoff
- `--technique [name]` — force a specific technique (default: auto-select)

## Process

1. **Restate the problem** — confirm understanding via AskUserQuestion. One question at a time.
2. **Select technique** — based on problem type, read `references/techniques/[selected].md`:
   - Default / "how to build X" → `multi-alternative.md`
   - Novel problem, no existing patterns → `first-principles.md`
   - Debugging/preventing failures → `reverse.md`
   - Many constraints, narrow solution space → `constraint-mapping.md`
3. **Generate ideas** — follow technique's process. Max 8 ideas per run.
4. **Format output** — use template from `assets/output-[mode].md`:
   - `--depth quick` → `assets/output-ideas.md`
   - `--depth deep` → `assets/output-scored.md` (score via `references/scoring-criteria.md`)
5. **Handoff** (deep mode only) — ask user: "Create plan from top idea?" If yes → invoke meow:plan-creator with idea + context + constraints.

**Hard gate:** Do NOT write code, create files outside reports, or invoke implementation skills.

## Gotchas (top 3)

- **Premature solutioning**: jumping to "how" before confirming "what" → force problem restatement first
- **Anchoring on first idea**: generate ALL ideas before evaluating any
- **Context flooding**: max 8 ideas per run — quality over quantity

Full list: `references/gotchas.md`

## Workflow Integration

Phase 1 (Plan) — pre-planning. Runs after problem validation (office-hours), before plan creation (plan-creator).

```
office-hours (validate) → brainstorming (explore) → plan-creator (plan)
```

## Handoff Protocol

On completion:

- Output saved to plans/reports/
- If action-plan mode: invoke meow:plan-creator with `{ idea, context, constraints, scores }`
- Plan-creator receives this as pre-research input, may skip its own discovery step
