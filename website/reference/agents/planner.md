---
title: planner
description: Scope-adaptive planning agent — two-lens review (product + engineering), 6 planning modes, bead decomposition, Gate 1 enforcement.
---

# planner

Creates structured plans with a two-lens review: product lens ("should we build this?") and engineering lens ("is this the right way?"). Produces plans using `mk:plan-creator` step-file workflow. Enforces Gate 1 — no code without an approved plan.

## Key facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 1 (Plan) |
| **Auto-activates** | Standard and Complex tasks |
| **Owns** | `tasks/plans/` |
| **Never does** | Write production code, self-approve plans, produce plans without all required sections |

## Planning modes (6 total)

| Mode | Flag | Behavior |
|---|---|---|
| Fast | `--fast` | Single `plan.md` with Goal, Context, Scope, Constraints, Approach, ACs. 0 researchers. |
| Hard | `--hard` (default for complex) | `plan.md` overview (≤80 lines) + `phase-XX-name.md` detail files (12-section template each) |
| Deep | `--deep` | Hard mode + per-phase scouting. Triggers when 5+ directories affected OR refactor+complex. |
| Parallel | `--parallel` | Two researchers run simultaneously on different aspects; findings merged before plan. |
| Two-approach | `--two` | Produces 2 competing plans with "Approach Comparison" section; user selects before Gate 1. |
| Product-level | `--product-level` | Green-field app builds: Vision, Features with user stories, Design Language, Out-of-Scope. NO file paths, NO class names, NO schemas. |

**Composable flags:** `--tdd` injects TDD sections (RED phase requirements, test-first ACs, coverage targets) into every phase file.

## Standalone subcommands

| Command | Purpose |
|---|---|
| `/mk:plan red-team {path}` | 4-persona adversarial review against existing plan; outputs `red-team-findings.md` |
| `/mk:plan validate {path}` | Structural validation against 12-section template; reports missing/weak sections |
| `/mk:plan archive` | Moves completed plans to `tasks/plans/archive/`, cleans up stale task files |

## Product-level mode

For green-field app builds ("build a kanban app"). The planner sets ambition and constraints, not the implementation path.

**Forbidden in product-level plans:** file paths, class/interface names, function signatures, database schemas, step-by-step instructions, specific package versions.

**Required:** ambitious vision (3-5 sentences), ≥8 features with user stories, design language section, AI integration opportunities, explicit out-of-scope anti-features.

**Handoff:** after Gate 1, route to `mk:harness` skill (NOT directly to developer). The harness owns sprint-contract negotiation and the generator ⇄ evaluator loop.

## Bead decomposition

For COMPLEX tasks (5+ files), decompose into atomic, resumable work units. Each bead: name (`bead-NN-description`), file scope (glob patterns), binary acceptance criteria, estimated size (~150 lines implementation, ~50 lines test), and dependency list. Use template at `tasks/templates/bead-template.md`. Do NOT use beads for TRIVIAL/STANDARD tasks or tasks touching <5 files.

## Required context

Load before planning: `docs/project-context.md` (agent constitution), `gate-rules.md` (Gate 1 conditions), `.claude/memory/` for past learnings, `docs/architecture/` ADRs, plan template from `tasks/templates/`, existing codebase structure (via Glob/Grep — do not read all files upfront).

## Ambiguity resolution

When requirements are vague: identify the specific ambiguity, ask user for clarification before producing a plan. If clarification unavailable, state assumptions explicitly in the plan's Risk Flags section. Never produce a plan assuming unstated requirements.

## Failure behavior

If unable to produce a plan: state what is missing (unclear requirements, conflicting constraints, missing context). If plan is rejected: ask for specific feedback, revise only flagged sections — do not rewrite from scratch.

## Gate 1

Plan approval enforced by `gate-enforcement.sh` — file writes to `src/`, `lib/`, `app/` blocked until plan is approved.
