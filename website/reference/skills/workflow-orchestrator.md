---
title: "mk:workflow-orchestrator"
description: "Auto-invoked 7-phase workflow coordinator for complex features — phase routing, token budget management, gate enforcement, fast-track mode."
---

# mk:workflow-orchestrator

## What This Skill Does

The central workflow coordinator. Auto-invoked when a session starts with complex-feature intent. Routes through the 7-phase pipeline (Orient → Plan → Test → Build → Simplify → Review → Ship → Reflect), managing gate enforcement, token budgets, agent team composition, and state persistence. Defers to `mk:cook` for single-task invocations.

## When to Use

- **Auto-invoked** on session start with complex-feature intent (multi-file, multi-step tasks)
- **NOT invoked** when `mk:cook` is explicitly called (cook owns the full pipeline for single tasks)
- **Never run both in the same session** — if cook is active, orchestrator skips

## Core Capabilities

- **7-phase routing:** Orient (agent-detector, scale-routing) → Plan (plan-creator) → Test (testing, TDD opt-in) → Build (developer) → Simplify (simplify — mandatory) → Review (review) → Ship (ship) → Reflect (memory)
- **Gate enforcement:** Gate 1 after Phase 1 (plan approval), Gate 2 after Phase 4 (review verdict)
- **Token budget:** warns at 75%, handoff at 85%, forces context reset at 90%. Target ≤30K per workflow.
- **State persistence:** `workflow:handoff` / `workflow:resume` / `workflow:status` commands for cross-session continuity
- **Agent Teams:** parallel agent execution per phase with file ownership boundaries and task claim pattern
- **Fast-track mode:** skips phases for pre-approved specs with automated testing. Auto-stops on: tests pass in RED, 3 failed builds, critical security findings, coverage <80%

## Arguments

| Flag | Effect |
|------|--------|
| (no flag) | Auto-invoked on complex feature intent |
| `--fasttrack` | Fast-track mode for pre-approved specs |
| `--teams` | Agent Teams parallel execution mode |

## Workflow

1. **Pre-execution checklist** — run agent-detector, load memory, show agent banner, verify complexity, challenge requirements
2. **Phase 0: Orient** — detect task agent, complexity tier, model selection
3. **Phase 1: Plan** — route to plan-creator, enforce Gate 1
4. **Phase 2: Test** — if TDD active, write failing tests
5. **Phase 3: Build** — developer implements, plan-first gate enforced
6. **Phase 3.5: Simplify** — mandatory simplification pass before review
7. **Phase 4: Review** — reviewer verdict, enforce Gate 2
8. **Phase 5: Ship** — shipper creates PR, pushes branch
9. **Phase 6: Reflect** — memory captures learnings

## Usage

```bash
# Auto-invoked — no explicit command needed
# Fast-track mode:
/mk:cook --fasttrack "add rate limiting middleware to the API"
```

## Example Prompt

```
Build a user dashboard with real-time metrics, role-based access control, and export to CSV. Use the existing auth system and PostgreSQL.
```

This triggers auto-invocation of the orchestrator with complex-feature intent.

## Common Use Cases

- Greenfield feature builds with multiple files
- Cross-cutting concerns (auth, logging, monitoring)
- Multi-phase features requiring plan → implement → review → ship
- Parallel agent execution for independent subtasks

## Pro Tips

- **Explicit `/mk:cook` overrides the orchestrator.** Use cook when you know exactly what you want to build and don't need the full phase orchestration.
- **Phase 3.5 (Simplify) is mandatory.** Code must be simplified before review — the orchestrator enforces this.
- **Invalid transitions are blocked:** you cannot skip Phase 1, ship with failing tests (Phase 5), or build without tests when TDD is active (Phase 3).

> **Canonical source:** `.claude/skills/workflow-orchestrator/SKILL.md`
