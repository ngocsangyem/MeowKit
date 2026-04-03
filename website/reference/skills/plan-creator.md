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
- **Gate 1 enforcement** — Plans must be approved via `AskUserQuestion` before implementation
- **Context Reminder** — After Gate 1 approval, prints a mode-matched cook command (e.g. `meow:cook --fast` in fast mode) so you never have to look up the flag
- **ADR generation** — Creates Architecture Decision Records in `docs/architecture/`
- **Validation** — Runs `validate-plan.py` to ensure plan completeness
- **Ops metrics guidance** — Detects metrics/KPI tasks, loads metric design philosophy to ensure outcome-focused targets
- **Cold-start context briefs** — Each phase file is self-contained so a fresh agent can execute any step cold without reading prior phases
- **Plan mutation protocol** — Formal rules for modifying plans mid-execution (split, insert, skip, reorder, abandon)
- **Worked examples** — Concrete reference showing expected detail level (Stripe billing 7-phase plan)

## Flag Modes

| Flag | Behavior |
|------|----------|
| *(none)* | Standard mode — full discovery + Gate 1 + validation |
| `--auto` | Auto-approves minor scope questions, still enforces Gate 1 |
| `--fast` | Skip discovery, quick template only, Gate 1 still runs |
| `--hard` | Extended discovery, multi-phase template enforced |
| `--parallel` | Splits plan into parallel implementation phases |

## Gate 1 — AskUserQuestion

After drafting, the skill presents the plan via `AskUserQuestion` with three options:

- **Approve** — proceed, skill prints context reminder + stops
- **Modify** — user provides feedback, plan is revised and Gate 1 re-runs
- **Reject** — planning stops, no plan file is written

## Output — Print & Stop

After Gate 1 approval, the skill ends with a **Print & Stop**:
- Prints a context reminder block with the mode-matched `/meow:cook [plan path]` command
- Stops — Claude will not proceed automatically
- You run the printed command when ready, or run a review skill first

## Usage
```bash
/meow:plan add pagination              # → auto-selects quick template
/meow:plan build auth system           # → auto-selects standard template
/meow:plan build auth system --fast    # → skip discovery, quick template
/meow:plan redesign API --parallel     # → parallel phase plan
```
::: info Skill Details
**Phase:** 1  
**Used by:** planner agent
**Plan-First Gate:** Creates plan if missing. Skips with plan path arg or `--fast` mode.
:::

## v2.0 Reference Additions

Four new reference files enhance plan-creator's capabilities:

| Reference | Loaded When | Purpose |
|-----------|-------------|---------|
| `ops-metrics-design.md` | Task involves KPIs, dashboards, SLAs | Outcome-focused metric philosophy |
| `cold-start-context-brief.md` | Every plan (default) | Template for self-contained phase files |
| `plan-mutation-protocol.md` | Modifying existing plan | Rules for split/insert/skip/reorder/abandon |
| `worked-example-stripe-billing.md` | Every plan (reference) | Concrete 7-phase plan showing expected detail |

## Gotchas

- **Wrong model for task type**: feature-model on a bug fix skips investigation → always confirm type first
- **Goal describes activity, not outcome**: "Implement OAuth" vs "Users can log in with OAuth" — next agent can't judge success → rewrite until Goal answers "what does done look like?"
- **Acceptance criteria that can't be verified**: "code is clean" blocks Gate 2 → every criterion must reference a specific command or file check
- **Phase files not self-contained**: "See phase-02 for context" in a phase file = failure. Each phase must state context directly. Use cold-start template.
- **Modifying plans without protocol**: Skipping a step without justification or splitting without acceptance criteria on both halves. Follow mutation protocol.
- **Metrics without red flags**: Defining targets without investigation thresholds. Use ops-metrics reference.

## Related
- [`meow:cook`](/reference/skills/cook) — Uses plan-creator as its first step
- [`meow:plan-eng-review`](/reference/skills/plan-eng-review) — Reviews plans created by plan-creator
- [`meow:plan-ceo-review`](/reference/skills/plan-ceo-review) — CEO-level plan review
- [`meow:decision-framework`](/reference/skills/decision-framework) — Guides model/approach selection during planning
- [`meow:api-design`](/reference/skills/api-design) — API design reference used in planning phases
- [`meow:verify`](/reference/skills/verify) — Verify step referenced in plan phase templates
