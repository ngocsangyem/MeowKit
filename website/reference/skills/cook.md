---
title: "meow:cook"
description: "End-to-end feature implementation pipeline with TDD enforcement, hard gates, and 7-phase workflow."
---

# meow:cook

End-to-end feature implementation pipeline with TDD enforcement, hard gates, and MeowKit's 7-phase workflow.

## What This Skill Does

`meow:cook` is the primary entry point for building features in MeowKit. Given a task description, a plan file path, or a set of flags, it automatically detects your intent, selects the right workflow mode, and orchestrates the full 7-phase pipeline — orient, plan, test, build, review, ship, and reflect — without requiring you to invoke each step manually.

**TDD is opt-in via `--tdd`**: when enabled, failing tests are written BEFORE implementation code (strict TDD). When disabled (the default), Phase 2 is optional and the developer implements directly per the approved plan. Gate 1 (plan approval) and Gate 2 (review approval) require human approval in ALL modes.

## Core Capabilities

- **Smart intent detection** — Analyzes your input to determine the right workflow mode
- **Workflow modes** — Interactive (default), fast, parallel, auto, no-test, code (from plan path), `--tdd` (opt-in strict TDD)
- **Opt-in TDD enforcement** — With `--tdd` / `MEOWKIT_TDD=1`: writes failing tests (Phase 2) before implementation (Phase 3). Without: Phase 2 is optional.
- **Hard Gate 1 and Gate 2** — Plan approval and review approval enforced. Gate 2 is NEVER auto-approved
- **Model tier routing** — Declares TRIVIAL/STANDARD/COMPLEX before work begins
- **Memory integration** — Reads prior learnings at start, writes back at end
- **Gate validation scripts** — Deterministic checks for plan/review completeness
- **Subagent delegation** — Routes each phase to specialist agents via Task() tool

## When to Use This

::: tip Use meow:cook when...
- You're building a new feature from scratch
- You have a plan file and want to execute it
- You need the full pipeline: plan → test → build → review → ship
- You want MeowKit to figure out the right workflow automatically
:::

::: warning Don't use meow:cook when...
- You're fixing a simple bug → use [`meow:fix`](/reference/skills/fix) instead
- You just want to review code → use [`meow:review`](/reference/skills/review)
- You just want to ship → use [`meow:ship`](/reference/skills/ship)
:::

## Usage

```bash
# Natural language — cook detects intent automatically
/meow:cook add user authentication with JWT

# From an existing plan file
/meow:cook tasks/plans/260327-auth-flow/plan.md

# Fast mode — skip research, plan still required
/meow:cook add login form --fast

# Strict TDD mode — failing tests required before implementation
/meow:cook build payment processor --tdd

# Parallel mode — spawn multiple agents for independent components
/meow:cook implement checkout system --parallel

# Auto mode — auto-fix issues, but Gate 2 still requires human approval
/meow:cook refactor payment module --auto

# No-test mode — skip Phase 2 entirely (forces TDD off even if --tdd set)
/meow:cook update readme --no-test
```

## 7-Phase Workflow

```
Phase 0: Orient → Phase 1: Plan [GATE 1] → Phase 2: Test (RED if --tdd, optional otherwise)
→ Phase 3: Build → Phase 3.5: Simplify → Phase 3.6: Verify
→ Phase 4: Review [GATE 2] + Ship → Phase 5: Reflect
```

1. **Orient** — Detect intent, declare model tier, **detect TDD mode**, read memory
2. **Plan** — Research + create plan → Gate 1 (human approval)
3. **Test** — In TDD mode: write failing tests from acceptance criteria. In default mode: optional (skip unless requested).
4. **Build** — Implement per plan. In TDD mode: until failing tests pass.
5. **3.5 Simplify** — Mandatory `meow:simplify` pass after build. Catches over-engineering before review.
6. **3.6 Verify** — Run `meow:verify` for unified build→lint→test→type→coverage check.
7. **Review + Ship** — Code review → Gate 2 (human approval) → commit + PR
8. **Reflect** — Sync plan, update docs, write memory

## Gotchas

- **Skipping Gate 1 on "simple" features**: Features that seem simple grow during implementation. Always create a plan file
- **Auto-approve sneaking bugs past Gate 2**: Auto mode can auto-fix but NEVER auto-approve. gate-rules.md says NO exceptions
- **Context loss between phases**: Long workflows exceed context. Update plan.md Agent State after each phase
- **Parallel mode deadlocks**: Phase dependencies cause deadlocks. Map dependency graph before spawning
- **Code mode on stale plans**: Running old plan against changed codebase. Warn if plan >14 days old
- **Fast mode shallow coverage**: Skipping research = plan-level tests only, not edge cases
- **Missing model tier declaration**: Always declare TRIVIAL/STANDARD/COMPLEX in Phase 0
- **Forgetting memory read/write**: Phase 0 reads memory/lessons.md; Phase 5 writes back
- **Using Agent() instead of Task()**: Task() enables tracking and blocking. Always use Task() for phases 2-5
- **Skipping simplify**: The mandatory simplify step catches over-engineering. Don't bypass it even if code "looks clean"
- **meow:verify failing on unknown project**: If project type not detected, verify asks user for commands. Don't skip.

## Related

- [`meow:fix`](/reference/skills/fix) — Lighter pipeline for bug fixes
- [`meow:ship`](/reference/skills/ship) — Just the shipping step
- [`meow:review`](/reference/skills/review) — Just the review step
- [`meow:plan-creator`](/reference/skills/plan-creator) — The plan template system cook uses
- [`meow:testing`](/reference/skills/testing) — TDD red-green-refactor reference
- [`meow:verify`](/reference/skills/verify) — Unified build→lint→test→type→coverage check (Phase 3.6)
- [`meow:simplify`](/reference/skills/simplify) — Mandatory over-engineering removal pass (Phase 3.5)
- [`meow:decision-framework`](/reference/skills/decision-framework) — Approach selection during orient phase
