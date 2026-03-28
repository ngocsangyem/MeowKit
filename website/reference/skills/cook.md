---
title: "meow:cook"
description: "End-to-end feature implementation pipeline with smart intent detection, TDD enforcement, and automatic workflow routing."
---

# meow:cook

End-to-end feature implementation pipeline with smart intent detection, TDD enforcement, and automatic workflow routing.

## What This Skill Does

`meow:cook` is the primary entry point for building features in MeowKit. Given a task description, a plan file path, or a set of flags, it automatically detects your intent, selects the right workflow mode, and orchestrates the full Phase 1→5 pipeline — planning, testing, implementing, reviewing, and shipping — without requiring you to invoke each step manually.

The skill is designed around the principle that **different tasks need different workflows.** A quick CSS fix doesn't need the same 12-step pipeline as a new authentication system. `meow:cook` detects this automatically from your input.

## Core Capabilities

- **Smart intent detection** — Analyzes your input (natural language, plan path, or flags) to determine the right workflow mode
- **Five workflow modes** — Interactive (default), fast (skip planning), parallel (multi-agent), auto (autonomous), no-test (skip TDD)
- **Full TDD enforcement** — Writes failing tests before implementation, verifies green after
- **Automatic Gate 1 and Gate 2** — Plan approval and review approval enforced unless mode opts out
- **Subagent delegation** — Routes testing to tester, review to reviewer, shipping to shipper
- **Fix-first review cycle** — After review, auto-fixes trivial issues before asking about non-trivial ones

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
/meow:cook tasks/plans/260327-auth-flow.md

# Fast mode — skip the planning step
/meow:cook add login form --fast

# Parallel mode — spawn multiple agents for independent components
/meow:cook implement checkout system --parallel

# Auto mode — fully autonomous, minimal user interaction
/meow:cook refactor payment module --auto

# No-test mode — skip TDD (use sparingly)
/meow:cook update readme --no-test
```

## Example Prompts

| Prompt | What happens |
|--------|-------------|
| `/meow:cook add shopping cart` | Interactive mode → full pipeline with both gates |
| `/meow:cook tasks/plans/260327-cart.md` | Detects plan path → loads plan → starts from Phase 2 |
| `/meow:cook fix auth token refresh --fast` | Fast mode → skips planning, goes straight to test+build |
| `/meow:cook implement API v2 endpoints --parallel` | Spawns parallel developer agents for independent endpoints |

## Quick Workflow

```
Input → Intent Detection → Mode Selection
                              ↓
        ┌─────── Interactive (default) ───────┐
        │  Plan → [Gate 1] → Test → Build     │
        │  → Review → [Gate 2] → Ship         │
        └─────────────────────────────────────┘
```

1. **Detect intent** from your input (natural language, plan path, or flags)
2. **Select mode** — interactive, fast, parallel, auto, or no-test
3. **Execute pipeline** — each phase delegates to the appropriate specialist agent
4. **Review cycle** — after implementation, reviewer checks; fix-first resolves trivial issues automatically
5. **Finalize** — orchestrator syncs plan status, documenter updates docs, shipper creates commit

::: info Skill Details
**Phase:** 1–5  
**Plan-First Gate:** Creates plan if missing. Skips with plan path arg or `--fast` mode.
:::

## Gotchas

- **Skipping Gate 1 on "simple" features**: Features that seem simple grow during implementation → Always create a plan file; cancel it if truly trivial
- **Context loss between phases**: Long multi-phase workflows exceed context window → Update Agent State section after each phase; next agent reads it first
- **Spinner hiding error output**: Spinner clears the line, masking error messages beneath → Log errors to stderr before spinner.fail()

## Related

- [`meow:fix`](/reference/skills/fix) — Lighter pipeline for bug fixes
- [`meow:ship`](/reference/skills/ship) — Just the shipping step
- [`meow:review`](/reference/skills/review) — Just the review step
- [`meow:plan-creator`](/reference/skills/) — The plan template system cook uses
