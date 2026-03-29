---
title: "meow:cook"
description: "End-to-end feature implementation pipeline with TDD enforcement, hard gates, and 7-phase workflow."
---

# meow:cook

End-to-end feature implementation pipeline with TDD enforcement, hard gates, and MeowKit's 7-phase workflow.

## What This Skill Does

`meow:cook` is the primary entry point for building features in MeowKit. Given a task description, a plan file path, or a set of flags, it automatically detects your intent, selects the right workflow mode, and orchestrates the full 7-phase pipeline — orient, plan, test RED, build GREEN, review, ship, and reflect — without requiring you to invoke each step manually.

The skill enforces **strict TDD**: failing tests are written BEFORE implementation code. Gate 1 (plan approval) and Gate 2 (review approval) require human approval in ALL modes.

## Core Capabilities

- **Smart intent detection** — Analyzes your input to determine the right workflow mode
- **Six workflow modes** — Interactive (default), fast, parallel, auto, no-test, code (from plan path)
- **Full TDD enforcement** — Writes failing tests (Phase 2) before implementation (Phase 3)
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

# Fast mode — skip research, still requires plan + TDD-flavored tests
/meow:cook add login form --fast

# Parallel mode — spawn multiple agents for independent components
/meow:cook implement checkout system --parallel

# Auto mode — auto-fix issues, but Gate 2 still requires human approval
/meow:cook refactor payment module --auto

# No-test mode — skip TDD (use sparingly)
/meow:cook update readme --no-test
```

## 7-Phase Workflow

```
Phase 0: Orient → Phase 1: Plan [GATE 1] → Phase 2: Test RED
→ Phase 3: Build GREEN → Phase 4: Review [GATE 2] + Ship → Phase 5: Reflect
```

1. **Orient** — Detect intent, declare model tier, read memory
2. **Plan** — Research + create plan → Gate 1 (human approval)
3. **Test RED** — Write failing tests from acceptance criteria
4. **Build GREEN** — Implement until tests pass (TDD)
5. **Review + Ship** — Code review → Gate 2 (human approval) → commit + PR
6. **Reflect** — Sync plan, update docs, write memory

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

## Related

- [`meow:fix`](/reference/skills/fix) — Lighter pipeline for bug fixes
- [`meow:ship`](/reference/skills/ship) — Just the shipping step
- [`meow:review`](/reference/skills/review) — Just the review step
- [`meow:plan-creator`](/reference/skills/plan-creator) — The plan template system cook uses
- [`meow:testing`](/reference/skills/testing) — TDD red-green-refactor reference
