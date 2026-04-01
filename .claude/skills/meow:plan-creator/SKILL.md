---
name: meow:plan-creator
version: 1.3.2
preamble-tier: 3
description: >-
  Creates structured multi-file plans before implementation. Scope-aware: trivial tasks
  exit early, simple tasks get fast plans, complex tasks get full research + phase files +
  validation. Enforces Gate 1. Activated by /meow:plan or /meow:cook.
argument-hint: "[task description] [--fast | --hard]"
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

## Trigger Conditions

Activate when:
- User runs `/meow:plan [task]` or `/meow:cook [task]`
- Non-trivial task (> 2 files OR > 1h OR architectural decisions)
- Gate 1 requires a plan before Phase 3

Skip when:
- `/meow:fix` with complexity=simple (Gate 1 exception)
- `meow:scale-routing` returns workflow=one-shot + zero blast radius

## Arguments

| Flag | Mode | Research | Phase Files | Validation |
|------|------|----------|-------------|------------|
| (default) | Auto-detect from scope | Follows mode | Follows mode | Follows mode |
| `--fast` | Fast | Skip | plan.md only | Semantic checks only |
| `--hard` | Hard | 2 researchers | plan.md + phases | Full interview |

## Workflow

Execute via `workflow.md`. Step-file architecture — load one step at a time.

```
Step 0: Scope Challenge → trivial (exit) | simple (fast) | complex (hard)
Step 1: Research (hard only) → 2 researchers, max 5 calls each
Step 2: Codebase Analysis (hard only) → scout + docs
Step 3: Draft Plan → plan.md (≤80 lines) + phase-XX files (12-section template)
Step 4: Validate + Gate 1 → semantic checks + interview (hard) + approval
Step 5: Hydrate Tasks → phase checkboxes → Claude Tasks
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
- **Skipping scout on unfamiliar codebases**: → always run meow:scout if codebase is new

## References

| File | Purpose |
|------|---------|
| `workflow.md` | Step sequence, variable table, flow diagram |
| `references/phase-template.md` | 12-section phase file template |
| `references/scope-challenge.md` | Scope modes (HOLD/EXPANSION/REDUCTION) |
| `references/research-phase.md` | Researcher spawning protocol |
| `references/plan-organization.md` | Directory structure, naming, size rules |
| `references/output-standards.md` | YAML frontmatter, required sections |
| `references/validation-questions.md` | Critical question categories for interview |
| `references/gate-1-approval.md` | AskUserQuestion gate + Context Reminder |
| `references/task-management.md` | Hydration, cross-session resume, sync-back |
| `references/solution-evaluation.md` | Trade-off scoring criteria |
| `references/gotchas.md` | Full gotchas list |
| `references/adr-generation.md` | Architecture Decision Record generation |
| `scripts/validate-plan.py` | Plan completeness validator |

## Start

Read and follow `workflow.md`.
