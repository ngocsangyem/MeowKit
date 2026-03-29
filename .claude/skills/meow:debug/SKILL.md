---
name: meow:debug
description: >-
  Structured debugging workflow: reproduce → isolate → root cause → fix → verify.
  Use when asked to "debug this", "why is X failing", "fix this bug", "investigate",
  or when tests fail after implementation. Prevents the guess-and-patch anti-pattern.
argument-hint: '"bug description" [--from-test test_name]'
source: meowkit
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
---

# Structured Debugging

Turns "fix this bug" into a disciplined investigation. No guessing, no patching blindly.

## Iron Rule

> **No fix without root cause.** If you can't explain WHY the bug happens, you haven't found it yet. Patching symptoms creates new bugs.

## Workflow

### Step 1: Reproduce
Confirm the bug exists and is reproducible.
- Run the failing test (if `--from-test` provided)
- Or reproduce from the description
- If can't reproduce → ask for more info, don't guess
- **Output:** exact reproduction steps + error output

### Step 2: Isolate
Narrow down WHERE the bug lives.
- Binary search through the call stack
- Check: is it in this function? This module? This dependency?
- Use `git bisect` if the bug is a regression
- **Output:** file:line where the bug originates (not where it manifests)

### Step 3: Root Cause
Determine WHY the bug happens at the isolated location.
- Read the surrounding code, not just the buggy line
- Check: what assumption is being violated?
- Check: what changed recently? (`git log --oneline -10 -- file`)
- **Output:** one-sentence root cause statement

### Step 4: Fix
Apply the minimal fix that addresses the root cause.
- Fix the cause, not the symptom
- Don't refactor adjacent code — scope discipline
- If the fix is >20 lines, consider whether the root cause is correct
- **Output:** diff of the fix

### Step 5: Verify
Confirm the fix works and doesn't break anything else.
- Run the originally failing test → should pass
- Run the full test suite → should pass (no regressions)
- If new edge cases discovered → write tests for them
- **Output:** test results

## Gotchas

- **"It works on my machine"** → check environment differences: Node version, env vars, OS, DB state
- **Fixing the symptom instead of the cause** → if your fix is a null check, ask WHY the value is null in the first place
- **Debug logging left behind** → remove all `console.log`, `debugger`, `print()` statements before committing
- **Regression from the fix** → always run full test suite, not just the failing test
- **Heisenbug (intermittent)** → likely race condition or timing issue. Add structured logging, don't add `sleep()`

## Integration with MeowKit Pipeline

- Called during Phase 3 (Build) when tests fail after implementation
- Called during Phase 5 (Debugging workflow from primary-workflow.md)
- After fix, routes back to tester agent for verification
- If fix fails 3 times → escalate per `tdd-rules.md` Rule 4

## References

See `references/` for:
- `references/common-root-causes.md` — patterns that cause 80% of bugs
