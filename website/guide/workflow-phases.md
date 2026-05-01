---
title: Workflow Phases (0-6)
description: Detailed breakdown of each phase — deliverables, agents, hooks, and execution modes.
persona: B
---

> **See also:** [Workflow Phases](/core-concepts/workflow) — the canonical, concise 7-phase reference.

# Workflow Phases — In Detail

This page expands each phase with agent details, deliverables, and hook enforcement. For the canonical overview (one sentence per phase), see the [core concepts page](/core-concepts/workflow).

## Phase 0 — Orient

**Agent:** orchestrator, analyst
**Deliverable:** Model tier assignment, execution mode, context loaded

- Read `docs/project-context.md` (agent constitution — auto-injected by `project-context-loader.sh`)
- Read relevant topic files on-demand (consumer skills handle this at task start)
- Run `mk:scale-routing` for domain-based complexity classification
- Load stack-relevant skills only (lazy loading)
- Print cost estimate before starting

**Navigation help:** `/mk:help` scans plans, reviews, tests, and git to determine pipeline state and prints the next action.

## Phase 1 — Plan

**Agent:** planner
**Deliverable:** `tasks/plans/YYMMDD-name/plan.md`

- `mk:plan-creator` — full plan creation (9-step workflow). Modes: `--fast`, `--hard`, `--deep`, `--parallel`, `--two`, `--product-level`
- `mk:plan-ceo-review` — product lens + engineering lens
- `mk:validate-plan` — 8-dimension quality check for COMPLEX tasks
- For COMPLEX tasks (5+ files): bead decomposition — atomic, independently committable work units

**Gate 1:** Human approval required. `gate-enforcement.sh` blocks all file writes until plan is approved.

## Phase 2 — Test

**Agent:** tester
**Deliverable:** Tests (failing in TDD mode; optional otherwise)

- **TDD mode** (`--tdd` / `MEOWKIT_TDD=1`): failing tests first. `pre-implement.sh` blocks if no failing test exists.
- **Default mode:** Phase 2 is optional. Tester invoked on-request.
- `mk:nyquist` verifies test-to-requirement coverage at end of phase.
- Security pre-check always runs.

## Phase 3 — Build

**Agent:** developer
**Deliverable:** Passing implementation

- Implement until tests pass
- `post-write.sh` hook: security scan on every file write
- Self-heal: auto-fix up to 3 attempts, each using a different approach
- For COMPLEX tasks: bead processing — commit after each bead, resume from last uncommitted bead
- For harness runs in FULL density: signed sprint contract required before source writes

## Phase 4 — Review

**Agent:** reviewer
**Deliverable:** `tasks/reviews/YYMMDD-name-verdict.md`

- 5-dimension audit: architecture, types, security, tests, performance
- Optional pre-review: `mk:scout` for edge case detection
- Optional post-verdict: `mk:elicit` for deeper analysis on WARN dimensions

**Gate 2:** Human approval required. FAIL blocks Phase 5.

**Optional flags** (cook only):
- `--verify`: lightweight browser check (~$1), advisory
- `--strict`: full evaluator with rubric grading (~$2-5), FAIL blocks ship

## Phase 5 — Ship

**Agent:** shipper
**Deliverable:** PR URL + rollback documentation

- `pre-ship.sh`: full test + lint + typecheck
- Conventional commit (auto-generated)
- PR — never push to main directly
- Verify CI passes before closing

## Phase 6 — Reflect

**Agent:** documenter, analyst
**Deliverable:** Updated memory + documentation

- Extract learnings as patterns, decisions, or failures
- Update `.claude/memory/` topic files
- Sync affected documentation
- Close sprint task

## Execution modes

| Mode | When | How |
|------|------|-----|
| Sequential | Default | One phase at a time |
| Parallel | COMPLEX with independent subtasks | Up to 3 agents in isolated git worktrees |
| Party | Architecture decisions | 2-4 agents deliberate, forced synthesis |

## Plan-first gate pattern

| Skill | Gate behavior | Skip condition |
|-------|-------------|----------------|
| `mk:cook` | Create plan if missing | Plan path arg, `--fast` |
| `mk:fix` | Plan if > 2 files | `--quick` |
| `mk:ship` | Require approved plan | Hotfix with human approval |
| `mk:cso` | Scope audit via plan | `--daily` |
| `mk:review` | Read plan for context | PR diff reviews |

Skills that skip: `mk:investigate` and `mk:office-hours` (produce planning input, run before plan exists); `mk:retro` (data-driven, no implementation).

## Next steps

- [Build a feature](/guides/build-a-feature) — the full cook pipeline
- [How gates work](/core-concepts/gates) — enforcement details
