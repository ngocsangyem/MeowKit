---
name: meow:help
description: >-
  Workflow navigation assistant. Scans project state (plans, reviews, tests, git)
  and recommends the next step in MeowKit's 7-phase pipeline. Use when asked
  "what should I do next?", "where am I?", "help", or at session start.
argument-hint: "[--verbose]"
source: meowkit
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# MeowKit Navigation Help

Answers "What should I do next?" by scanning project state and mapping to the 7-phase pipeline.

## How It Works

Scan these sources in order, stop at the first actionable recommendation:

### 1. Paused Step-File Workflows
Check `session-state/*-progress.json` for any in-progress step-file workflow.
- Found → "Resume [skill] at step [N]. Run `/meow:[skill]` to continue."

### 2. In-Progress Plans
Check `tasks/plans/` for plan files without matching review verdicts.
- Plan exists, no tests → "Plan approved. Next: run tester agent (Phase 2 — RED)"
- Plan exists, tests failing → "Tests failing. Next: run developer agent (Phase 3 — GREEN)"
- Plan exists, tests passing, no review → "Tests green. Next: run reviewer agent (Phase 4 — Review)"

### 3. Pending Reviews
Check `tasks/reviews/` for verdict files with WARN or action items.
- WARN verdict → "Review has warnings. Acknowledge and approve for Gate 2, or fix findings."
- FAIL verdict → "Review failed. Fix required changes, then re-run reviewer."

### 4. Uncommitted Changes
Check `git status` for staged/unstaged changes.
- Changes exist + review approved → "Ready to ship. Run `/meow:ship` (Phase 5)"
- Changes exist, no review → "Changes detected but no review. Run reviewer first."

### 5. Clean State
No plans, no reviews, no changes.
- "Everything clean. Options: start a new task with planner, run `/meow:retro`, or ask me anything."

## State-to-Recommendation Map

| State | Pipeline Phase | Recommendation |
|-------|---------------|----------------|
| No plan | Phase 0 → 1 | "Start with `/meow:plan-creator` or describe your task" |
| Plan approved, no tests | Phase 2 | "Run tester agent — write failing tests (RED phase)" |
| Tests written, failing | Phase 3 | "Run developer agent — implement to pass tests (GREEN)" |
| Tests passing, no review | Phase 4 | "Run `/meow:review` — adversarial code review" |
| Review PASS/WARN | Phase 5 | "Run `/meow:ship` — commit, PR, deploy" |
| Shipped | Phase 6 | "Run documenter — update docs, then `/meow:retro`" |
| Paused workflow | Resume | "Resume [skill] at step [N]" |
| Mixed state | Clarify | "Multiple items in progress. Which to focus on?" |

## Gotchas

- Multiple in-progress plans create ambiguity — ask user which to focus on, don't guess
- `session-state/` files from previous sessions may be stale — check timestamps, warn if >24h old
- Git status can be noisy (untracked IDE files) — focus on files in `src/`, `lib/`, `app/`, `tests/`
- Don't recommend skipping phases — even if the user seems impatient, show the full path

## Output Format

```
## MeowKit Status

**Current phase:** [Phase N — Name]
**State:** [brief description]

### Recommended Next Step
[action] — [why]

### Other Options
- [alternative action]
- [alternative action]
```

If `--verbose` flag: also show full state scan results (plan files, review files, test status, git status).
