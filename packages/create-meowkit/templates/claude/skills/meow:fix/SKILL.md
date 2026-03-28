---
name: meow:fix
description: "ALWAYS activate this skill before fixing ANY bug, error, test failure, CI/CD issue, type error, lint, log error, UI issue, code problem."
source: claudekit-engineer
version: 2.0.0
argument-hint: "[issue] --auto|--review|--quick|--parallel"
---

# Fixing

Unified skill for fixing issues of any complexity with structured diagnosis.

<HARD-GATE>
Do NOT propose or implement fixes before completing Steps 1-2 (Scout + Diagnose).
Symptom fixes are failure. Find the cause first through structured analysis, NEVER guessing.
If 3+ fix attempts fail, STOP and question the architecture — discuss with user.
Override: `--quick` allows fast scout→diagnose→fix for trivial issues (lint, type errors).
</HARD-GATE>

## Arguments

- `--auto` — Autonomous mode (**default**). Auto-approve if score >= 9.5 & 0 critical.
- `--review` — Human-in-the-loop. Pause at each step.
- `--quick` — Fast cycle for trivial bugs.
- `--parallel` — Parallel `fullstack-developer` agents per independent issue.

## Plan-First Gate

For moderate/complex bugs:
1. Run `meow:investigate` to confirm root cause
2. If fix affects > 2 files → `meow:plan-creator --type bugfix`
3. Wait for Gate 1 approval

Skip: `--quick` mode (single file, clear cause).

## Step 0 — Mode Selection

If no mode flag: use `AskUserQuestion` (Autonomous / HITL / Quick). See `references/mode-selection.md`.

## Step 1 — Scout (MANDATORY — never skip)

Activate `meow:scout` to map affected codebase BEFORE any diagnosis:
- Affected files, dependencies, related tests, recent changes (`git log`)
- Quick mode: minimal scout (affected file + direct deps only)
- Standard/Deep: full scout (module boundaries, test coverage, call chains)

**Why mandatory:** Without codebase context, diagnosis guesses instead of reasons from evidence.

## Step 2 — Diagnose (MANDATORY — never skip)

**Capture pre-fix state first:** exact error messages, failing test output, stack traces.

Then structured diagnosis using two skills:

1. **meow:investigate** — collect symptoms, traces, reproduction steps
2. **meow:sequential-thinking** — generate hypotheses from evidence, test each, eliminate, conclude

Load `references/diagnosis-protocol.md` for the 5-phase protocol: Observe → Hypothesize → Test → Trace → Escalate.

Output: confirmed root cause (not symptom) with evidence chain + confidence level.

**BLOCK:** If confidence < medium → gather more evidence before fixing. Never fix a "maybe."

## Step 3 — Complexity Assessment

Classify before routing. See `references/complexity-assessment.md`.

| Level | Indicators | Workflow |
|-------|------------|----------|
| **Simple** | Single file, clear error | `references/workflow-quick.md` |
| **Moderate** | Multi-file, root cause multi-step | `references/workflow-standard.md` |
| **Complex** | System-wide, architecture impact | `references/workflow-deep.md` |
| **Parallel** | 2+ independent issues | Parallel agents per issue |

Task orchestration (Moderate+): `references/task-orchestration.md`.

## Step 4 — Fix Implementation

- Fix must address ROOT CAUSE from Step 2 — never symptoms only
- Minimal changes, follow existing patterns
- If fix deviates from diagnosis → re-diagnose first

## Step 5 — Verify + Prevent (MANDATORY)

1. **Iron-law verify:** Re-run exact pre-fix commands. Compare before/after.
2. **Regression test:** Test that fails WITHOUT fix, passes WITH fix.
3. **Defense-in-depth:** Load `references/prevention-gate.md` — consider entry validation, business logic guards, error handling, type safety.
4. **BLOCK:** No regression test = fix is incomplete.

If verify fails: loop to Step 2. After 3 failures → STOP, question architecture.

## Step 6 — Finalize (MANDATORY)

1. Report: confidence, root cause, changes, files, prevention measures
2. `documenter` agent → update `./docs`
3. Ask user about commit

## Skill Activation

**Always:** `meow:scout` (Step 1) + `meow:investigate` (Step 2) + `meow:sequential-thinking` (Step 2)
**Conditional:** `meow:brainstorming` (complex, multiple approaches) | `meow:docs-finder` (unfamiliar APIs)

## Gotchas

- **Guessing root causes**: "I think it's X" without evidence → use meow:sequential-thinking to generate + test hypotheses from evidence
- **Fixing symptoms**: test passes but underlying issue remains → always trace backward: symptom → cause → ROOT cause
- **Skipping scout**: fixing without codebase context → mandatory scout maps what you're touching
- **No regression test**: bug resurfaces next sprint → every fix includes a test that fails without the fix
- **3+ failed attempts without stopping**: insanity loop → STOP, question architecture, discuss with user

Full list: `references/gotchas.md` (update when Claude produces wrong fix patterns)

## References

- `references/mode-selection.md` — AskUserQuestion format
- `references/diagnosis-protocol.md` — 5-phase structured diagnosis
- `references/prevention-gate.md` — defense-in-depth + verification checklist
- `references/complexity-assessment.md` — Simple/Moderate/Complex/Parallel
- `references/task-orchestration.md` — Task patterns for moderate+
- `references/workflow-quick.md` | `workflow-standard.md` | `workflow-deep.md`
- `references/review-cycle.md` — Autonomous/HITL/Quick review
- `references/skill-activation-matrix.md` — When to activate each skill
- `references/workflow-ci.md` | `workflow-logs.md` | `workflow-test.md` | `workflow-types.md` | `workflow-ui.md`
