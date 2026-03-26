---
title: "meow:fix"
description: "Structured bug investigation and fix with auto-complexity detection, parallel exploration, and multiple workflow modes."
---

# meow:fix

Structured bug investigation and fix with auto-complexity detection, parallel exploration, and multiple workflow modes.

## What This Skill Does

`meow:fix` is MeowKit's debugging pipeline. Instead of immediately editing code when you report a bug, it forces a structured investigation: assess complexity, choose the right workflow, find the root cause, write a regression test, then apply the minimal fix. The skill adapts its approach based on how complex the bug is — a typo gets a quick fix, while a cross-module race condition gets the full investigation treatment.

## Core Capabilities

- **Auto-complexity assessment** — Classifies bugs as Quick (typo, config), Standard (logic, one module), or Deep (cross-cutting, architectural)
- **Four fix modes** — Autonomous (default), human-in-the-loop review, quick (for trivial issues), parallel (for multi-file problems)
- **Root cause methodology** — Uses `meow:investigate` for systematic 5-phase debugging
- **Parallel exploration** — Spawns multiple Explore subagents to verify hypotheses simultaneously
- **Regression test guarantee** — Every fix includes a test that fails without the fix and passes with it
- **Scope locking** — Uses `meow:freeze` to restrict edits to affected modules, preventing scope creep

## When to Use This

::: tip Use meow:fix when...
- You've found a bug and need it investigated properly
- Tests are failing and you need to understand why
- A CI/CD pipeline is broken
- You're seeing unexpected behavior in production
- Type errors, lint failures, or UI glitches need fixing
:::

::: warning Don't use meow:fix when...
- You're building a new feature → use [`meow:cook`](/reference/skills/cook)
- The issue is a design/architecture concern → use architect agent
:::

## Usage

```bash
# Default — autonomous mode, auto-detects complexity
/meow:fix login fails after 24 hours

# Review mode — pauses for approval at each step
/meow:fix payment processing timeout --review

# Quick mode — for trivial issues (typos, lint, config)
/meow:fix TypeScript error in auth.ts --quick

# Parallel mode — spawns agents per issue for multi-file problems
/meow:fix all failing tests in checkout module --parallel
```

## Example Prompts

| Prompt | Complexity | Mode |
|--------|-----------|------|
| `/meow:fix typo in README.md` | Quick | Quick — direct fix, no investigation |
| `/meow:fix session token not refreshed` | Standard | Autonomous — investigate → fix → test |
| `/meow:fix intermittent race condition in payment queue` | Deep | Full investigation with parallel exploration |
| `/meow:fix CI failing on main branch` | Standard | Autonomous — check CI logs, reproduce, fix |

## Quick Workflow

```
Bug Report → Complexity Assessment
                    ↓
    ┌──── Quick ────┤──── Standard ────┤──── Deep ────┐
    │  Direct fix   │  Investigate     │  Full debug  │
    │  + test       │  → fix → test    │  + parallel  │
    │  (Gate 1      │  → review        │  exploration │
    │   skipped)    │  → ship          │  → fix → ship│
    └───────────────┴──────────────────┴──────────────┘
```

1. **Assess complexity** — Quick, Standard, or Deep based on symptom analysis
2. **Select workflow** — Routes to the appropriate investigation depth
3. **Investigate** — Collects symptoms, traces code path, checks git history, reproduces
4. **Hypothesis testing** — Forms and tests hypotheses (3-strike escalation rule)
5. **Fix + regression test** — Minimal fix with a test that proves it works
6. **Review + ship** — Gate 2 applies (Gate 1 skipped for simple fixes)

## Related

- [`meow:investigate`](/reference/skills/investigate) — The debugging methodology used inside fix
- [`meow:cook`](/reference/skills/cook) — Full pipeline for new features
- [`meow:scout`](/reference/skills/scout) — Helps find relevant files during investigation
