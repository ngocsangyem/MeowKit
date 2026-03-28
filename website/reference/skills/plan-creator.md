---
title: "meow:plan-creator"
description: "Creates plans and ADRs. Selects workflow model, sizes scope, validates, and enforces Gate 1."
---
# meow:plan-creator
Creates plans and Architecture Decision Records (ADRs). Selects workflow model, sizes scope, validates completeness, and enforces Gate 1.
## What This Skill Does
When `/meow:plan` or `/meow:cook` is invoked, this skill determines the workflow model (feature, bugfix, refactor, security), selects the right plan template by scope, drafts the plan, validates it, and presents it for Gate 1 approval. Also handles ADR generation for architecture decisions.
## Core Capabilities
- **Institutional memory retrieval** — Reads `memory/lessons.md` and `memory/patterns.json` before planning to prevent re-solving known problems
- **Structured discovery** — Investigates 4 areas (architecture, existing patterns, constraints, external) before drafting
- **Workflow model selection** — Routes to feature, bugfix, refactor, or security model
- **Template selection** — Auto-routes to quick, standard, or multi-phase template by scope
- **Risk classification** — Maps components to LOW/MEDIUM/HIGH risk, guiding tester and reviewer prioritization
- **Gate 1 enforcement** — Plans must be approved before implementation
- **ADR generation** — Creates Architecture Decision Records in `docs/architecture/`
- **Validation** — Runs `validate-plan.py` to ensure plan completeness
## Usage
```bash
/meow:plan add pagination    # → auto-selects quick template
/meow:plan build auth system # → auto-selects standard template
```
::: info Skill Details
**Phase:** 1  
**Used by:** planner agent
**Plan-First Gate:** Creates plan if missing. Skips with plan path arg or `--fast` mode.
:::

## Gotchas

- **Wrong model for task type**: feature-model on a bug fix skips investigation → always confirm type first
- **Goal describes activity, not outcome**: "Implement OAuth" vs "Users can log in with OAuth" — next agent can't judge success → rewrite until Goal answers "what does done look like?"
- **Acceptance criteria that can't be verified**: "code is clean" blocks Gate 2 → every criterion must reference a specific command or file check

## Related
- [`meow:cook`](/reference/skills/cook) — Uses plan-creator as its first step
- [`meow:plan-eng-review`](/reference/skills/plan-eng-review) — Reviews plans created by plan-creator
- [`meow:plan-ceo-review`](/reference/skills/plan-ceo-review) — CEO-level plan review
