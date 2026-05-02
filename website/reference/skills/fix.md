---
title: "mk:fix"
description: "Structured bug investigation — auto-complexity detection, root cause analysis, mandatory regression tests."
---

# mk:fix

Structured debugging pipeline. Instead of immediately editing code, it forces structured investigation: assess complexity, find root cause, write a regression test, apply the minimal fix. Auto-detects complexity — a typo gets a quick fix, a race condition gets full investigation.

## Usage

```bash
/mk:fix login fails after 24 hours                    # Autonomous (default)
/mk:fix payment processing timeout --review            # Human-in-the-loop at each step
/mk:fix TypeScript error in auth.ts --quick            # Fast cycle for trivial bugs
/mk:fix all failing tests in checkout --parallel       # Parallel agents per issue
/mk:fix "auth bypass" --tdd                            # Force regression test before fix
```

## Process flow

```
Bug → Mode Select → Check Memory → Scout (MANDATORY) → Diagnose
  → [investigate → sequential-thinking → root cause?]
  → yes → Complexity → Fix ROOT CAUSE → Verify+Prevent (MANDATORY)
  → pass → Finalize + Write to Memory
  → fail <3 → re-diagnose | fail 3+ → STOP
```

## Step 0 — Mode selection

If no mode flag: `AskUserQuestion` (Autonomous / Human-in-the-loop / Quick). Autonomous auto-approves if score ≥ 9.5 and 0 critical findings.

## Step 0.5 — Check fix memory

Read `.claude/memory/fixes.md` and `fixes.json` for prior patterns. Search for similar symptoms, error messages, or affected modules. If a matching fix pattern exists → use as starting hypothesis. If a matching success pattern exists → apply known fix approach directly. This turns repeated bugs into instant fixes.

## Step 1 — Scout (MANDATORY)

Activate `mk:scout` to map affected codebase: files, dependencies, related tests, recent changes (`git log`). Quick mode: minimal (affected file + direct deps). Standard/Deep: full scout. Never skip — without codebase context, diagnosis guesses instead of reasoning from evidence.

## Step 2 — Diagnose (MANDATORY)

Capture pre-fix state: exact error messages, failing test output, stack traces. Then structured diagnosis: `mk:investigate` collects symptoms, traces, reproduction steps. `mk:sequential-thinking` generates hypotheses from evidence, tests each, eliminates, concludes. Output: confirmed root cause with evidence chain + confidence level. **BLOCK:** if confidence < medium → gather more evidence before fixing.

## Step 3 — Complexity assessment

| Level | Indicators | Workflow |
|---|---|---|
| Simple | Single file, clear error | Quick fix |
| Moderate | Multi-file, multi-step root cause | Standard pipeline |
| Complex | System-wide, architecture impact | Deep investigation |
| Parallel | 2+ independent issues | Parallel agents per issue |

## Step 4 — Fix implementation

Must address ROOT CAUSE from Step 2 — never symptoms only. Minimal changes, follow existing patterns. If fix deviates from diagnosis → re-diagnose first.

## Step 5 — Verify + Prevent (MANDATORY)

1. Re-run exact pre-fix commands — compare before/after
2. Regression test: fails WITHOUT fix, passes WITH fix
3. Defense-in-depth: consider entry validation, business logic guards, error handling, type safety
4. **BLOCK:** no regression test = fix is incomplete

If verify fails: loop to Step 2. After 3 failures → STOP, question architecture, discuss with user.

## Step 6 — Finalize + Learn

1. Report: confidence, root cause, changes, files, prevention measures
2. Write to memory: append to `fixes.md` (symptom → root cause → fix → prevention), update `fixes.json`
3. Delegate to `project-manager` (Moderate/Complex only, background)
4. `documenter` agent → update docs

## Hard gates

- No fix before scout + diagnose complete (Steps 1-2)
- Confidence below "medium" blocks the fix
- 3 failed attempts stops the pipeline — question the architecture
- Symptom fixes are failure — find the cause first through structured analysis, never guessing

## Plan-first gate

For moderate/complex bugs: run `mk:investigate` to confirm root cause. If fix affects > 2 files → `mk:plan-creator --type bugfix`. Skip: `--quick` mode (single file, clear cause).

## Gotchas

- Guessing root causes — use `mk:sequential-thinking` to test hypotheses from evidence
- Fixing symptoms — trace backward: symptom → cause → ROOT cause
- Skipping scout — mandatory scout maps what you're touching
- No regression test — bug resurfaces next sprint
- 3+ failed attempts without stopping — STOP, question architecture
