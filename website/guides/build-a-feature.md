---
title: Build a Feature
description: Step-by-step guide to building features with /mk:cook — from plan to ship.
---

# Build a Feature

`/mk:cook` is the primary workflow for building features. It runs the full 7-phase pipeline — you describe what you want, and MeowKit handles planning, testing, building, reviewing, and shipping.

## Quick start

```bash
/mk:cook add user authentication with JWT
```

That's it. MeowKit detects your intent, creates a plan, and walks through each phase. You approve at two checkpoints (Gate 1 and Gate 2).

## Common workflows

### From a natural language description

```bash
/mk:cook add pagination to the user list API
```

MeowKit classifies the task, selects the right model tier, and creates a plan. You review and approve the plan before any code is written.

### From an existing plan file

```bash
/mk:cook tasks/plans/260501-pagination/plan.md
```

Skips the planning phase. The plan must already be approved (Gate 1).

### With TDD

```bash
/mk:cook build payment processor --tdd
```

Failing tests are written before implementation. The developer cannot write code until tests exist and fail. Use `--tdd` for production-critical features.

### Fast mode

```bash
/mk:cook add login form --fast
```

Skips research. The planner still creates a plan, but without deep codebase analysis. Good for well-understood features with clear scope.

### Parallel mode

```bash
/mk:cook implement checkout system --parallel
```

Spawns up to 3 agents in isolated git worktrees for independent subtasks. Use when the plan has clearly independent components.

## What happens at each phase

| Phase | What you see | What you do |
|-------|-------------|------------|
| 0 — Orient | Task classified, model tier declared | Nothing — automatic |
| 1 — Plan | Plan created with acceptance criteria | **Approve the plan** (Gate 1) |
| 2 — Test | Tests written from acceptance criteria | Review test coverage |
| 3 — Build | Implementation proceeds | Watch for self-healing attempts |
| 4 — Review | 5-dimension audit with verdict | **Approve the review** (Gate 2) |
| 5 — Ship | PR created, CI triggered | Merge when CI passes |
| 6 — Reflect | Patterns captured to memory | Nothing — automatic |

## Choosing the right mode

| Situation | Mode |
|-----------|------|
| New feature, clear scope | Default: `/mk:cook "description"` |
| Production-critical feature | `--tdd` for strict test-first discipline |
| Well-understood feature | `--fast` to skip research |
| Feature with independent parts | `--parallel` for parallel agents |
| Feature from existing plan | Pass the plan path directly |
| Docs-only change | `--no-test` to skip Phase 2 |

## Gotchas

- **Simple features grow.** Always let MeowKit create a plan — a "simple" feature that touches 3 files needs planning.
- **Gate 2 is never auto-approved.** The `--auto` flag fixes issues but still requires your review approval.
- **Long sessions lose context.** The plan's Agent State section auto-updates — read it if you resume mid-build.

## Next steps

- [Fix a bug](/guides/fix-a-bug) — structured debugging with `/mk:fix`
- [Autonomous builds](/guides/autonomous-build) — green-field products with `/mk:harness`
- [Understand the workflow](/core-concepts/workflow) — the 7-phase pipeline in detail
