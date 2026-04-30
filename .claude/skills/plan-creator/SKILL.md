---
name: mk:plan-creator
version: 1.5.0
preamble-tier: 3
description: >-
  Creates structured multi-file implementation plans before build. Scope-aware: trivial tasks
  exit early, simple tasks get fast plans, complex tasks get full research + phase files +
  validation. Enforces Gate 1. Activated by /mk:plan or /mk:cook.
  NOT for ticket complexity analysis against an existing codebase (see mk:planning-engine);
  NOT for CEO-level scope review of existing plans (see mk:plan-ceo-review).
argument-hint: "[task description] [--fast | --hard | --deep | --parallel | --two | --product-level [--no-design] [--no-scout]] [--tdd] OR [archive | red-team {path} | validate {path}]"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
source: meowkit
---

# Plan Creator

Scope-aware planning with step-file workflow. Produces plan.md overview + phase-XX detail files.

## When to Use

Activate when:

- User runs `/mk:plan [task]` or `/mk:cook [task]`
- Non-trivial task (> 2 files OR > 1h OR architectural decisions)
- Gate 1 requires a plan before Phase 3
- Green-field product build ("build a kanban app", "create a SaaS dashboard", "make a retro game maker") → step-00 auto-detects and offers `--product-level`
- User runs `/mk:plan archive` → route to `references/archive-workflow.md` (skip planning pipeline)
- User runs `/mk:plan red-team {path}` → route to `references/red-team-standalone.md` (skip planning pipeline)
- User runs `/mk:plan validate {path}` → route to `references/validate-standalone.md` (skip planning pipeline)

Skip when:

- `/mk:fix` with complexity=simple (Gate 1 exception)
- `mk:scale-routing` returns workflow=one-shot + zero blast radius

## Arguments

| Flag              | Mode                   | Research                | Phase Files                                                              | Validation                                                                   |
| ----------------- | ---------------------- | ----------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| (default)         | Auto-detect from scope | Follows mode            | Follows mode                                                             | Follows mode                                                                 |
| `--fast`          | Fast                   | Skip                    | plan.md only                                                             | Semantic checks only                                                         |
| `--hard`          | Hard                   | 2 researchers           | plan.md + phases                                                         | Full interview                                                               |
| `--deep`          | Deep                   | 2-3 researchers         | plan.md + phases + per-phase file inventory & dependency maps            | Full interview                                                               |
| `--parallel`      | Parallel               | 2 researchers           | plan.md + phases + ownership matrix                                      | Full interview                                                               |
| `--two`           | Two approaches         | 2 researchers           | 2 approach files + trade-off matrix                                      | After selection                                                              |
| `--product-level` | Product spec           | 2 researchers (broader) | plan.md only (user stories + features + design language; NO phase files) | Semantic + check-product-spec.sh (no red-team, no validation interview — v1) |

## Workflow

Before starting, read `references/failure-catalog.md` for common planning failure modes to avoid.

Execute via `workflow.md`. Step-file architecture — load one step at a time.
Fast mode (`--fast`) uses `workflow-fast.md` (steps 00→03→04→07→08).

```
Step 0: Scope Challenge → trivial (exit) | simple (fast) | complex (hard/deep)
Step 1: Research (hard/deep/parallel/two only) → 2-3 researchers, max 5 calls each
Step 2: Codebase Analysis (hard/deep/parallel/two only) → scout + docs (deep: 2-3 parallel scouts)
Step 3: Draft Plan → plan.md (≤80 lines) + phase-XX files (12-section template; deep: + per-phase file inventory & dependency maps)
Step 4: Semantic Checks → goal/ACs/constraints + structural validation
Step 5: Red Team (hard/deep/parallel/two only) → 4-persona scaling, red-team-findings.md, adjudication
Step 6: Validation Interview (hard/deep/parallel/two only) → 3-5 critical questions with detection keywords, propagate answers
Step 7: Gate 1 → self-check + AskUserQuestion (Approve | Modify | Reject)
Step 8: Hydrate Tasks → phase checkboxes → Claude Tasks
```

## Output Structure

**Fast mode:** Single `plan.md` (goal, context, scope, approach, ACs)
**Hard mode:** Directory with plan.md + phase files:

```
tasks/plans/YYMMDD-name/
├── plan.md              ← overview (≤80 lines)
├── research/            ← researcher reports (hard mode)
├── phase-01-name.md     ← 12-section detail (≤150 lines)
├── phase-02-name.md
└── ...
```

## Gotchas

- **Wrong workflow model**: feature-model on a bug fix skips investigation → confirm type at Step 0
- **Goal describes activity**: "Implement OAuth" vs "Users can log in with OAuth" → rewrite as outcome
- **ACs can't be verified**: "code is clean" blocks Gate 2 → every AC must reference a command/file check
- **Monolithic plan**: plan.md over 80 lines → move detail to phase files or research reports
- **Research disconnected**: findings archived but not cited in plan → Step 3 MUST integrate research into Key Insights
- **Over-planning trivial tasks**: 2-file config change gets full research → Step 0 scope gate exits early
- **Skipping scout on unfamiliar codebases**: → always run mk:scout if codebase is new

## References

| File                                               | Purpose                                                                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow.md`                                      | Step sequence, variable table, flow diagram (hard mode)                                                                                                                       |
| `workflow-fast.md`                                 | Compact step sequence for `--fast` mode (00→03→04→07→08)                                                                                                                      |
| `step-03a-product-spec.md`                         | Product-level spec drafter: user stories, features, design language. Replaces step-03 when `planning_mode = product-level`.                                                   |
| `assets/product-spec-template.md`                  | Product spec template (Vision, Features, Design Language, AI Integration, Out-of-Scope)                                                                                       |
| `references/anthropic-example-plan.md`             | RetroForge few-shot calibration example for product-level mode (ambition + feature density reference)                                                                         |
| `step-05-red-team.md`                              | Red team review: persona scaling, subagent dispatch, adjudication                                                                                                             |
| `step-06-validation-interview.md`                  | Critical question generation and answer propagation                                                                                                                           |
| `step-07-gate.md`                                  | Self-check and Gate 1 AskUserQuestion presentation                                                                                                                            |
| `prompts/personas/plan-assumption-destroyer.md`    | Plan-specific assumption skeptic persona                                                                                                                                      |
| `prompts/personas/plan-scope-complexity-critic.md` | Plan-specific YAGNI/scope minimalist persona                                                                                                                                  |
| `prompts/personas/plan-security-adversary.md`      | Plan-specific security adversary (auth bypass, injection, data exposure). Used at 4+ phases.                                                                                  |
| `prompts/personas/plan-failure-mode-analyst.md`    | Plan-specific failure mode analyst (race conditions, cascading failures, recovery). Used at 6+ phases.                                                                        |
| `references/phase-template.md`                     | 12-section phase file template                                                                                                                                                |
| `references/ops-metrics-design.md`                 | If task involves metrics/KPIs/dashboards, load for metric philosophy, templates, and domain fallbacks                                                                         |
| `references/cold-start-context-brief.md`           | When writing phase files, follow this template for self-contained, cold-start-safe phase files                                                                                |
| `references/plan-mutation-protocol.md`             | When modifying an existing plan (split/insert/skip/reorder/abandon), follow this protocol                                                                                     |
| `references/worked-example-stripe-billing.md`      | For plan detail level reference, see this complete worked example (the 7-phase model)                                                                                         |
| `references/scope-challenge.md`                    | Scope modes (HOLD/EXPANSION/REDUCTION)                                                                                                                                        |
| `references/research-phase.md`                     | Researcher spawning protocol                                                                                                                                                  |
| `references/plan-organization.md`                  | Directory structure, naming, size rules                                                                                                                                       |
| `references/output-standards.md`                   | YAML frontmatter, required sections                                                                                                                                           |
| `references/validation-questions.md`               | Critical question categories for interview                                                                                                                                    |
| `references/gate-1-approval.md`                    | AskUserQuestion gate + Context Reminder                                                                                                                                       |
| `references/task-management.md`                    | Hydration, cross-session resume, sync-back                                                                                                                                    |
| `references/solution-evaluation.md`                | Trade-off scoring criteria                                                                                                                                                    |
| `references/gotchas.md`                            | Full gotchas list                                                                                                                                                             |
| `references/solution-design-checklist.md`          | Trade-off analysis checklist for Architecture/Risk/Security sections (5 dimensions)                                                                                           |
| `references/archive-workflow.md`                   | Archive subcommand: scan completed plans, journal, archive/delete                                                                                                             |
| `references/red-team-standalone.md`                | Red-team standalone subcommand: adversarial review on existing plan                                                                                                           |
| `references/validate-standalone.md`                | Validate standalone subcommand: critical question interview on existing plan                                                                                                  |
| `references/adr-generation.md`                     | Architecture Decision Record generation                                                                                                                                       |
| `references/parallel-mode.md`                      | Ownership matrix template, parallel group rules                                                                                                                               |
| `references/two-approach-mode.md`                  | Approach file template, trade-off matrix, selection flow                                                                                                                      |
| `scripts/validate-plan.py`                         | Plan completeness validator                                                                                                                                                   |
| `scripts/check-product-spec.sh`                    | Product-spec structural validator (POSIX bash). Enforces feature count, user stories, forbidden patterns. Used by step-03a §3a.5 and step-04 §4a' for `--product-level` mode. |
| `references/workflow-models/feature-model.md`      | Workflow template for feature tasks (loaded JIT by step-00)                                                                                                                   |
| `references/workflow-models/bugfix-model.md`       | Workflow template for bug fix tasks (loaded JIT by step-00)                                                                                                                   |
| `references/workflow-models/refactor-model.md`     | Workflow template for refactor tasks (loaded JIT by step-00)                                                                                                                  |
| `references/workflow-models/security-model.md`     | Workflow template for security tasks (loaded JIT by step-00)                                                                                                                  |

## Related Rules

- `.claude/rules/gate-rules.md` — Gate 1 hard-stop conditions this skill enforces (plan approval before Phase 3)

## Start

Read and follow `workflow.md`.
