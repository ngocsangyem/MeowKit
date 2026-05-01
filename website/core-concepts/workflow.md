---
title: Workflow Phases
description: The canonical 7-phase pipeline. Every task flows through these phases with two hard gates requiring human approval.
---

# Workflow Phases

Every non-trivial task flows through MeowKit's 7-phase pipeline. Two phases have hard gates requiring explicit human approval. No phase can be skipped.

```
Phase 0: Orient → Phase 1: Plan → [GATE 1] → Phase 2: Test
→ Phase 3: Build → Phase 4: Review → [GATE 2]
→ Phase 5: Ship → Phase 6: Reflect
```

## Why phases exist

Without structure, AI agents skip testing, self-approve their work, and ship directly to main. Each phase is a deliberate checkpoint that prevents a specific failure mode:

| Phase | Prevents |
|-------|----------|
| Orient | Wrong agent/model for the task |
| Plan | Building the wrong thing |
| Test | Untested code reaching production |
| Build | Implementation drifting from plan |
| Review | Shipping unreviewed code |
| Ship | Direct pushes to main |
| Reflect | Repeating the same mistakes |

## Phase 0 — Orient

**Agent:** orchestrator
**What happens:** Classify the task, assign model tier, load relevant memory.

The orchestrator reads the task description, determines complexity (Trivial / Standard / Complex), assigns the right AI model tier (Haiku / Sonnet / Opus), and loads relevant memory topic files. Domain-based routing ensures fintech and healthcare tasks always get COMPLEX tier. No code is touched.

## Phase 1 — Plan

**Agent:** planner
**What happens:** Create a structured plan with acceptance criteria.

The planner produces a plan file at `tasks/plans/YYMMDD-name/plan.md` with goal, acceptance criteria, constraints, and scope. For complex tasks (5+ files), the plan includes bead decomposition — atomic, independently committable work units.

**Gate 1: Human approves the plan.** No code can be written until this happens. The `gate-enforcement.sh` hook blocks all file writes before plan approval.

## Phase 2 — Test

**Agent:** tester
**What happens:** Write tests that validate the plan's acceptance criteria.

**TDD mode** (`--tdd` / `MEOWKIT_TDD=1`): failing tests must exist before implementation. The `pre-implement.sh` hook blocks code without corresponding failing tests. **Default mode** (TDD off): tests are recommended but not gated.

## Phase 3 — Build

**Agent:** developer
**What happens:** Implement the plan until all tests pass.

The developer reads the approved plan and implements per acceptance criteria. Self-heals up to 3 times on test failures, each attempt using a different approach. After 3 failures, escalates to human. For complex tasks, processes bead decomposition sequentially — commits after each bead.

## Phase 4 — Review

**Agent:** reviewer
**What happens:** 5-dimension structural audit.

The reviewer checks architecture fit, type safety, test coverage, security, and performance. Produces a verdict at `tasks/reviews/YYMMDD-name-verdict.md`: PASS, PASS WITH NOTES, or FAIL. Optional flags: `--verify` adds a lightweight browser check; `--strict` runs the full evaluator with rubric grading.

**Gate 2: Human approves the review verdict.** No shipping until this happens. FAIL blocks Phase 5 entirely.

## Phase 5 — Ship

**Agent:** shipper
**What happens:** Safe deployment.

Runs full test/lint/typecheck via `pre-ship.sh`, creates a conventional commit, opens a PR. Never pushes directly to main. Documents rollback steps.

## Phase 6 — Reflect

**Agent:** documenter, analyst
**What happens:** Capture learnings for future sessions.

Extracts patterns, decisions, and failures from the session. Writes to the appropriate topic files in `.claude/memory/`. Updates documentation. Closes the task.

## Execution modes

| Mode | When | How |
|------|------|-----|
| Sequential | Default for all tasks | One phase at a time, single agent per phase |
| Parallel | Complex tasks with independent subtasks | Up to 3 agents in isolated git worktrees |
| Party | Architecture decisions, trade-off analysis | 2-4 agents deliberate, forced synthesis |

## Gates enforced by hooks

MeowKit uses shell hooks to upgrade behavioral rules to preventive enforcement — the action is blocked before it executes:

| Hook | Event | What it blocks |
|------|-------|---------------|
| `gate-enforcement.sh` | PreToolUse (Edit\|Write) | Source code writes before Gate 1 approval |
| `privacy-block.sh` | PreToolUse (Read) | `.env`, `*.key`, credential file reads |
| `pre-completion-check.sh` | Stop | Session end without verification evidence |

## Next steps

- [How agents and skills work together](/core-concepts/how-it-works)
- [Build a feature end-to-end](/guide/agent-skill-architecture)
- [Understand the gates](/core-concepts/gates)
