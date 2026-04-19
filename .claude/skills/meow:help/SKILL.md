---
name: meow:help
description: >-
  Workflow navigation assistant. Scans project state (plans, reviews, tests, git)
  and recommends the next step in the 7-phase pipeline. Use when asked
  "what should I do next?", "where am I?", "help", or at session start.
argument-hint: "[--verbose]"
source: meowkit
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Navigation Help

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

For skill suggestions based on task type, see `.claude/skills/meow:agent-detector/references/lifecycle-routing.md`.

## State-to-Recommendation Map

> Alias: `/meow:plan` routes to `meow:plan-creator` (slash-command wrapper at `.claude/commands/meow/plan.md`). Subcommands `red-team`, `validate`, `archive` are handled by the same skill.

| State | Pipeline Phase | Recommendation |
|-------|---------------|----------------|
| No plan | Phase 0 → 1 | "Start with `/meow:plan` or describe your task" |
| Existing plan — stress-test | Standalone subcommand | "`/meow:plan red-team {path}` — adversarial review of existing plan" |
| Existing plan — interview | Standalone subcommand | "`/meow:plan validate {path}` — critical question interview on existing plan" |
| Completed/cancelled plans | Housekeeping | "`/meow:plan archive` — archive completed or cancelled plans" |
| Plan approved, no tests | Phase 2 (TDD mode only) | "In TDD mode (`--tdd` / `MEOWKIT_TDD=1`): run tester agent — write failing tests (RED phase). In default mode: skip Phase 2; run developer directly" |
| Tests written, failing | Phase 3 | "Run developer agent — implement to pass tests (GREEN)" |
| Tests passing, no review | Phase 4 | "Run `/meow:review` — adversarial code review" |
| Review PASS/WARN | Phase 5 | "Run `/meow:ship` — commit, PR, deploy" |
| Shipped | Phase 6 | "Run documenter — update docs, then `/meow:retro`" |
| Paused workflow | Resume | "Resume [skill] at step [N]" |
| Mixed state | Clarify | "Multiple items in progress. Which to focus on?" |

## Specialist Skills (surface when domain matches)

| Situation | Skill | When to suggest |
|-----------|-------|----------------|
| Operations, triage, case management, escalation protocols, billing workflows | `/meow:decision-framework` | User asks "how should we handle X cases" or is designing any case-routing system |
| "Is everything green?", pre-review check, post-implementation validation | `/meow:verify` | After implementation completes, before review, or when user wants a quick health check |
| API design, endpoint structure, REST/GraphQL conventions | `/meow:api-design` | User is planning backend endpoints or asking about API conventions |

## Fast Paths (surface these prominently)

Not every task needs the full 7-phase pipeline. Mention these when relevant:

| Situation | Fast Path | What it bypasses |
|-----------|-----------|-----------------|
| Simple bug fix, typo, rename, config tweak | `/meow:fix` | Gate 1 (plan approval) — scope is the plan |
| Task flagged as `one-shot` by scale-routing | Auto Gate 1 bypass | Gate 1 — zero blast radius confirmed |
| Rapid iteration / spike work | `MEOW_HOOK_PROFILE=fast` | post-write scan, pre-ship, pre-task-check, TDD check |

**Quick fix?** Use `/meow:fix` — bypasses Gate 1 for simple changes.

**Small config change?** Scale-routing may auto-bypass Gate 1 when blast radius is zero.

**Hook profiles:** Set `MEOW_HOOK_PROFILE=fast` for rapid iteration (skips non-critical hooks).
Set `MEOW_HOOK_PROFILE=strict` to enable ALL hooks including cost-meter and post-session capture.

## Gotchas

- Multiple in-progress plans create ambiguity — ask user which to focus on, don't guess
- `session-state/` files from previous sessions may be stale — check timestamps, warn if >24h old
- Git status can be noisy (untracked IDE files) — focus on files in `src/`, `lib/`, `app/`, `tests/`
- Don't recommend skipping phases — even if the user seems impatient, show the full path
- Fast paths are not loopholes — Gate 2 (review) is NEVER bypassed; security hooks are NEVER skipped

## Output Format

```
## Status

**Current phase:** [Phase N — Name]
**State:** [brief description]

### Recommended Next Step
[action] — [why]

### Other Options
- [alternative action]
- [alternative action]
```

If `--verbose` flag: also show full state scan results (plan files, review files, test status, git status).
