---
title: "mk:help"
description: "Navigation assistant — scans project state (plans, reviews, tests, git) and recommends the next step in the 7-phase pipeline."
---

# mk:help — Workflow Navigation

## What This Skill Does

Answers "What should I do next?" by scanning project state and mapping to the 7-phase pipeline. Use at session start, after interruption, or when uncertain about the next step.

## When to Use

- "what should I do next?", "where am I?", "help"
- At session start to orient
- After an interruption to resume
- When the pipeline state is ambiguous

Explicit: `/mk:help [--verbose]`

**NOT for:** Domain complexity routing (see `mk:scale-routing`), skill discovery (skill descriptions handle that automatically), or task-type-to-skill suggestions (see `mk:agent-detector`).

## Core Capabilities

Scans these sources in order, stops at the first actionable recommendation:

1. **Paused Step-File Workflows** — checks `session-state/*-progress.json` for in-progress step-file skills.
2. **In-Progress Plans** — checks `tasks/plans/` for plans without matching review verdicts, maps to Phase 2/3/4.
3. **Pending Reviews** — checks `tasks/reviews/` for WARN or FAIL verdicts needing action.
4. **Uncommitted Changes** — checks `git status` for staged/unstaged changes + review approval status.
5. **Clean State** — no plans, no reviews, no changes → suggests starting new task or running retro.

## State-to-Recommendation Map

| State | Pipeline Phase | Recommendation |
|---|---|---|
| No plan | Phase 0 → 1 | "Start with `/mk:plan` or describe your task" |
| Existing plan — stress-test | Standalone subcommand | "`/mk:plan red-team {path}` — adversarial review of existing plan" |
| Existing plan — interview | Standalone subcommand | "`/mk:plan validate {path}` — critical question interview on existing plan" |
| Completed/cancelled plans | Housekeeping | "`/mk:plan archive` — archive completed or cancelled plans" |
| Plan approved, no tests | Phase 2 (TDD mode only) | "In TDD mode (`--tdd` / `MEOWKIT_TDD=1`): run tester agent (RED). In default mode: skip Phase 2; run developer directly" |
| Tests written, failing | Phase 3 | "Run developer agent — implement to pass tests (GREEN)" |
| Tests passing, no review | Phase 4 | "Run `/mk:review` — adversarial code review" |
| Review PASS/WARN | Phase 5 | "Run `/mk:ship` — commit, PR, deploy" |
| Shipped | Phase 6 | "Run documenter — update docs, then `/mk:retro`" |
| Paused workflow | Resume | "Resume [skill] at step [N]" |
| Mixed state | Clarify | "Multiple items in progress. Which to focus on?" |

## Specialist Skills

These surface when the user's domain matches:

| Situation | Skill | When to suggest |
|---|---|---|
| Operations, triage, case management, escalation protocols, billing workflows | `/mk:decision-framework` | User asks "how should we handle X cases" or is designing any case-routing system |
| "Is everything green?", pre-review check, post-implementation validation | `/mk:verify` | After implementation completes, before review, or when user wants a quick health check |
| API design, endpoint structure, REST/GraphQL conventions | `/mk:api-design` | User is planning backend endpoints or asking about API conventions |

## Fast Paths

Not every task needs the full 7-phase pipeline:

| Situation | Fast Path | What it bypasses |
|---|---|---|
| Simple bug fix, typo, rename, config tweak | `/mk:fix` | Gate 1 (plan approval) — scope is the plan |
| Task flagged as `one-shot` by scale-routing | Auto Gate 1 bypass | Gate 1 — zero blast radius confirmed |
| Rapid iteration / spike work | `MEOW_HOOK_PROFILE=fast` | post-write scan, pre-ship, pre-task-check, TDD check |

**Quick fix?** Use `/mk:fix` — bypasses Gate 1 for simple changes.
**Hook profiles:** Set `MEOW_HOOK_PROFILE=fast` for rapid iteration (skips non-critical hooks). Set `MEOW_HOOK_PROFILE=strict` to enable ALL hooks including cost-meter and post-session capture.

## Arguments

| Argument | Effect |
|---|---|
| (none) | Quick recommendation |
| `--verbose` | Full state scan results: plan files found, review files found, test status, git status |

## Example Prompt

```
I just came back to this project after a break. What should I do next? Show me the full state scan.
```

## Usage
